"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
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

  revalidatePath("/admin/concorrentes");
  revalidatePath("/painel");
  redirect("/admin/concorrentes?salvo=1");
}

export async function excluirConcorrente(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("concorrentes").delete().eq("id", String(formData.get("id"))).eq("e_nosso", false);
  revalidatePath("/admin/concorrentes");
  revalidatePath("/painel");
  redirect("/admin/concorrentes");
}
