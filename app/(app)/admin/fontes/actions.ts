"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { classificarPendentes } from "@/lib/classificacao-ia";
import { getTarefa } from "@/lib/config";
import {
  importarAvaliacoes,
  LIMITE_LINHAS,
  linhasDoCsv,
  linhasDoTexto,
  parseData,
  type LinhaImportacao,
} from "@/lib/importacao";
import { TIPOS_FONTE, type TipoFonte } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";

export type EstadoFonte = { erro?: string; ok?: string };

export async function criarFonte(_: EstadoFonte, formData: FormData): Promise<EstadoFonte> {
  await requireAdmin();
  const concorrente_id = String(formData.get("concorrente_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoFonte;
  const url = String(formData.get("url") ?? "").trim() || null;

  if (!concorrente_id) return { erro: "Escolha o concorrente." };
  if (!(tipo in TIPOS_FONTE)) return { erro: "Escolha o tipo da fonte." };
  if (url && !/^https?:\/\//i.test(url)) return { erro: "A URL precisa começar com https://" };

  const supabase = await createClient();
  const { error } = await supabase.from("fontes").insert({ concorrente_id, tipo, url });
  if (error) return { erro: "Não foi possível salvar: " + error.message };

  revalidatePath("/admin/fontes");
  return { ok: `Fonte ${TIPOS_FONTE[tipo]} adicionada.` };
}

export async function excluirFonte(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("fontes").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/fontes");
}

export type EstadoImportacao = {
  erro?: string;
  novas?: number;
  duplicadas?: number;
  avisos?: string[];
  classificandoIa?: boolean;
};

export async function importar(_: EstadoImportacao, formData: FormData): Promise<EstadoImportacao> {
  await requireAdmin();
  const supabase = await createClient();

  const fonteId = String(formData.get("fonte_id") ?? "");
  const { data: fonte } = await supabase
    .from("fontes")
    .select("id, concorrente_id, url")
    .eq("id", fonteId)
    .maybeSingle();
  if (!fonte) return { erro: "Fonte não encontrada." };

  let linhas: LinhaImportacao[];
  let avisos: string[] = [];

  if (formData.get("modo") === "csv") {
    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo CSV." };
    if (arquivo.size > 4 * 1024 * 1024) return { erro: "Arquivo maior que 4 MB. Divida em partes." };
    const r = linhasDoCsv(await arquivo.text());
    if (r.erro) return { erro: r.erro };
    linhas = r.linhas;
    avisos = r.ignoradas;
  } else {
    const texto = String(formData.get("texto") ?? "");
    const dataBruta = String(formData.get("data") ?? "");
    linhas = linhasDoTexto(texto, dataBruta ? parseData(dataBruta) : null);
  }

  if (linhas.length === 0) return { erro: "Nenhuma avaliação encontrada para importar.", avisos };
  if (linhas.length > LIMITE_LINHAS) {
    return { erro: `Máximo de ${LIMITE_LINHAS} avaliações por importação (recebidas ${linhas.length}).` };
  }

  const r = await importarAvaliacoes(supabase, fonte, linhas);
  if (r.erro) return { erro: "Falha ao gravar: " + r.erro, avisos };

  revalidatePath("/admin/fontes");
  revalidatePath("/admin/analise");

  // Com a IA configurada, classifica as novas depois de responder (o admin não fica esperando).
  const classificacao = r.novas > 0 ? await getTarefa("classificacao") : null;
  if (classificacao) {
    after(async () => {
      const resultado = await classificarPendentes({ fonteId: fonte.id, limite: LIMITE_LINHAS });
      if (resultado.erro) console.error("classificação automática após importação:", resultado.erro);
    });
  }
  return { novas: r.novas, duplicadas: r.duplicadas, avisos, classificandoIa: !!classificacao };
}
