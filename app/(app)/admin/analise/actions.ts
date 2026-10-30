"use server";

import { revalidatePath } from "next/cache";
import { limitarPalavras, salvarAnalise } from "@/lib/analise";
import { requireAdmin } from "@/lib/auth";
import { SENTIMENTOS, type Sentimento } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";

export type EstadoClassificacao = { erro?: string; ok?: boolean };

export async function classificar(_: EstadoClassificacao, formData: FormData): Promise<EstadoClassificacao> {
  await requireAdmin();
  const supabase = await createClient();

  const avaliacaoId = String(formData.get("avaliacao_id") ?? "");
  const sentimento = String(formData.get("sentimento") ?? "") as Sentimento;
  const temas = formData.getAll("temas").map(String);
  let resumo = String(formData.get("resumo") ?? "").trim();

  if (!(sentimento in SENTIMENTOS)) return { erro: "Escolha o sentimento." };
  if (temas.length === 0 && sentimento !== "neutro") return { erro: "Marque pelo menos um tema." };

  if (!resumo) {
    const { data } = await supabase.from("avaliacoes").select("texto_original").eq("id", avaliacaoId).single();
    resumo = limitarPalavras(data?.texto_original ?? "");
  }

  const r = await salvarAnalise(supabase, avaliacaoId, { sentimento, temas, resumo_curto: resumo }, "manual");
  if (r.erro) return { erro: r.erro };

  revalidatePath("/admin/analise");
  return { ok: true };
}
