"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ErroOpenRouter } from "@/lib/openrouter";
import { pesquisarConcorrente, type SugestaoConcorrente } from "@/lib/pesquisa-concorrente";
import { TIPOS_FONTE } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";

export type EstadoForm = { erro?: string };

const texto = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

const numero = (f: FormData, k: string) => {
  const v = texto(f, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function urlValida(v: string | null) {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function salvarConcorrente(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await requireAdmin();
  const supabase = await createClient();

  const id = texto(formData, "id");
  const concorrente = {
    nome: texto(formData, "nome"),
    site: texto(formData, "site"),
    segmento: texto(formData, "segmento"),
    logo: texto(formData, "logo"),
    observacoes: texto(formData, "observacoes"),
    ativo: formData.get("ativo") === "on",
  };

  if (!concorrente.nome) return { erro: "Informe o nome do concorrente." };
  if (!urlValida(concorrente.site)) return { erro: "O site precisa ser uma URL completa (https://...)." };
  if (!urlValida(concorrente.logo)) return { erro: "O logo precisa ser uma URL completa (https://...)." };

  let concorrenteId = id;
  if (id) {
    const { error } = await supabase.from("concorrentes").update(concorrente).eq("id", id);
    if (error) return { erro: "Não foi possível salvar: " + error.message };
  } else {
    const { data, error } = await supabase.from("concorrentes").insert(concorrente).select("id").single();
    if (error) return { erro: "Não foi possível salvar: " + error.message };
    concorrenteId = data.id;
  }

  const dados = {
    concorrente_id: concorrenteId,
    tempo_de_mercado: texto(formData, "tempo_de_mercado"),
    funcionarios: texto(formData, "funcionarios"),
    vagas_abertas: numero(formData, "vagas_abertas"),
    nota_glassdoor: numero(formData, "nota_glassdoor"),
    reputacao_reclame_aqui: texto(formData, "reputacao_reclame_aqui"),
    ultimo_investimento: texto(formData, "ultimo_investimento"),
    fonte: texto(formData, "fonte_dados"),
    atualizado_em: new Date().toISOString(),
  };
  const temDados = Object.entries(dados).some(
    ([k, v]) => !["concorrente_id", "atualizado_em"].includes(k) && v !== null,
  );
  if (temDados) {
    if (dados.nota_glassdoor !== null && (dados.nota_glassdoor < 0 || dados.nota_glassdoor > 5)) {
      return { erro: "A nota do Glassdoor vai de 0 a 5." };
    }
    const { error } = await supabase.from("dados_empresa").upsert(dados);
    if (error) return { erro: "Concorrente salvo, mas os dados da empresa falharam: " + error.message };
  }

  // Fontes de avaliação marcadas no painel da pesquisa (ignora as que já existem).
  const fontesNovas = formData
    .getAll("fontes_novas")
    .map((v) => {
      try {
        return JSON.parse(String(v)) as { tipo: string; url: string };
      } catch {
        return null;
      }
    })
    .filter((f): f is { tipo: string; url: string } => !!f && f.tipo in TIPOS_FONTE && urlValida(f.url) && !!f.url);
  if (fontesNovas.length > 0) {
    const { data: existentes } = await supabase.from("fontes").select("url").eq("concorrente_id", concorrenteId!);
    const ja = new Set(existentes?.map((f) => f.url));
    const inserir = fontesNovas
      .filter((f) => !ja.has(f.url))
      .map((f) => ({ concorrente_id: concorrenteId, tipo: f.tipo, url: f.url }));
    if (inserir.length > 0) {
      const { error } = await supabase.from("fontes").insert(inserir);
      if (error) return { erro: "Concorrente salvo, mas as fontes falharam: " + error.message };
    }
  }

  revalidatePath("/admin/concorrentes");
  revalidatePath("/admin/fontes");
  revalidatePath("/painel");
  redirect("/admin/concorrentes?salvo=1");
}

export type ResultadoPesquisa = { sugestao?: SugestaoConcorrente; erro?: string };

export async function pesquisar(nome: string, site: string | null, segmento: string | null): Promise<ResultadoPesquisa> {
  await requireAdmin();
  if (!nome.trim()) return { erro: "Digite o nome do concorrente antes de pesquisar." };
  if (site && !urlValida(site)) site = null;

  // Sem segmento informado, usa o do nosso software para desambiguar nomes parecidos.
  if (!segmento) {
    const supabase = await createClient();
    const { data } = await supabase.from("concorrentes").select("segmento").eq("e_nosso", true).maybeSingle();
    segmento = data?.segmento ?? null;
  }

  try {
    return { sugestao: await pesquisarConcorrente(nome.trim(), site, segmento) };
  } catch (e) {
    if (e instanceof ErroOpenRouter) return { erro: e.message };
    if ((e as Error).name === "TimeoutError") return { erro: "A pesquisa demorou demais. Tente novamente." };
    console.error("pesquisa de concorrente", e);
    return { erro: "Não foi possível concluir a pesquisa. Tente novamente." };
  }
}

export async function excluirConcorrente(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("concorrentes").delete().eq("id", String(formData.get("id"))).eq("e_nosso", false);
  revalidatePath("/admin/concorrentes");
  revalidatePath("/painel");
  redirect("/admin/concorrentes");
}
