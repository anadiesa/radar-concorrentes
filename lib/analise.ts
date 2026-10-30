import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sentimento } from "./rotulos";

export type ResultadoAnalise = {
  sentimento: Sentimento;
  temas: string[]; // ids da tabela temas
  resumo_curto: string;
};

export const MAX_PALAVRAS_RESUMO = 15;

export function limitarPalavras(texto: string, max = MAX_PALAVRAS_RESUMO) {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  return palavras.length <= max ? palavras.join(" ") : palavras.slice(0, max).join(" ") + "…";
}

/**
 * Grava a análise de uma avaliação. Ponto único de escrita: hoje usado pela classificação
 * manual (modelo = "manual"); a análise por IA usará a mesma função com o id do modelo.
 * Nunca sobrescreve: se a avaliação já tiver análise, retorna erro.
 */
export async function salvarAnalise(
  supabase: SupabaseClient,
  avaliacaoId: string,
  analise: ResultadoAnalise,
  modelo: string,
): Promise<{ erro?: string }> {
  const { error } = await supabase.from("analises").insert({
    avaliacao_id: avaliacaoId,
    sentimento: analise.sentimento,
    resumo_curto: limitarPalavras(analise.resumo_curto),
    modelo,
  });
  if (error) {
    return { erro: error.code === "23505" ? "Esta avaliação já foi analisada." : error.message };
  }

  if (analise.temas.length > 0) {
    const { error: e2 } = await supabase
      .from("analise_temas")
      .insert(analise.temas.map((tema_id) => ({ avaliacao_id: avaliacaoId, tema_id })));
    if (e2) {
      // Sem temas a análise fica incompleta: desfaz para a avaliação voltar à fila.
      await supabase.from("analises").delete().eq("avaliacao_id", avaliacaoId);
      return { erro: e2.message };
    }
  }
  return {};
}
