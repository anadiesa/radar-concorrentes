"use server";

import { revalidatePath } from "next/cache";
import { limitarPalavras, revisarAnalise, salvarAnalise } from "@/lib/analise";
import { classificarPendentes, type ResultadoClassificacao } from "@/lib/classificacao-ia";
import { requireAdmin } from "@/lib/auth";
import { SENTIMENTOS, type Sentimento } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";

export type EstadoClassificacao = { erro?: string; ok?: boolean };

function lerClassificacao(formData: FormData) {
  return {
    avaliacaoId: String(formData.get("avaliacao_id") ?? ""),
    sentimento: String(formData.get("sentimento") ?? "") as Sentimento,
    temas: formData.getAll("temas").map(String),
    resumo: String(formData.get("resumo") ?? "").trim(),
  };
}

function validar(sentimento: Sentimento, temas: string[]) {
  if (!(sentimento in SENTIMENTOS)) return "Escolha o sentimento.";
  if (temas.length === 0 && sentimento !== "neutro") return "Marque pelo menos um tema.";
  return null;
}

export async function classificar(_: EstadoClassificacao, formData: FormData): Promise<EstadoClassificacao> {
  await requireAdmin();
  const supabase = await createClient();

  const { avaliacaoId, sentimento, temas } = lerClassificacao(formData);
  let { resumo } = lerClassificacao(formData);
  const invalido = validar(sentimento, temas);
  if (invalido) return { erro: invalido };

  if (!resumo) {
    const { data } = await supabase.from("avaliacoes").select("texto_original").eq("id", avaliacaoId).single();
    resumo = limitarPalavras(data?.texto_original ?? "");
  }

  const r = await salvarAnalise(supabase, avaliacaoId, { sentimento, temas, resumo_curto: resumo }, "manual");
  if (r.erro) return { erro: r.erro };

  revalidatePath("/admin/analise");
  return { ok: true };
}

/** Confirma ou corrige uma classificação feita pela IA. */
export async function revisar(_: EstadoClassificacao, formData: FormData): Promise<EstadoClassificacao> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { avaliacaoId, sentimento, temas, resumo } = lerClassificacao(formData);
  const invalido = validar(sentimento, temas);
  if (invalido) return { erro: invalido };
  if (!resumo) return { erro: "O resumo não pode ficar vazio." };

  const r = await revisarAnalise(supabase, avaliacaoId, { sentimento, temas, resumo_curto: resumo }, admin.user_id);
  if (r.erro) return { erro: r.erro };

  revalidatePath("/admin/analise");
  return { ok: true };
}

export async function classificarComIa(): Promise<ResultadoClassificacao> {
  await requireAdmin();
  const r = await classificarPendentes({ limite: 200 });
  revalidatePath("/admin/analise");
  return r;
}
