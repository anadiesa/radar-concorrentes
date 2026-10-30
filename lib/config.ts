import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

export type ConfigOpenRouter = {
  apiKey: string;
  modelo: string | null;
  /** Modelo para classificar avaliações (tarefa simples e de volume); cai no modelo principal se vazio. */
  modeloClassificacao: string | null;
  origem: "ambiente" | "sistema";
};

const CHAVE_API = "openrouter_api_key";
const CHAVE_MODELO = "openrouter_modelo";
const CHAVE_MODELO_CLASSIFICACAO = "openrouter_modelo_classificacao";

async function ler(chaves: string[]) {
  const { data } = await createAdminClient().from("configuracoes").select("chave, valor").in("chave", chaves);
  return Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor])) as Record<string, string>;
}

/** Configuração da OpenRouter. A variável de ambiente tem prioridade sobre a tela de Configurações. */
export async function getOpenRouter(): Promise<ConfigOpenRouter | null> {
  const salvo = await ler([CHAVE_API, CHAVE_MODELO, CHAVE_MODELO_CLASSIFICACAO]);
  const modelo = process.env.OPENROUTER_MODEL || salvo[CHAVE_MODELO] || null;
  const modeloClassificacao =
    process.env.OPENROUTER_MODEL_CLASSIFICACAO || salvo[CHAVE_MODELO_CLASSIFICACAO] || modelo;

  if (process.env.OPENROUTER_API_KEY) {
    return { apiKey: process.env.OPENROUTER_API_KEY, modelo, modeloClassificacao, origem: "ambiente" };
  }
  if (salvo[CHAVE_API]) return { apiKey: salvo[CHAVE_API], modelo, modeloClassificacao, origem: "sistema" };
  return null;
}

export async function salvarConfig(valores: Record<string, string | null>, userId: string) {
  const supabase = createAdminClient();
  const agora = new Date().toISOString();
  for (const [chave, valor] of Object.entries(valores)) {
    const { error } = valor
      ? await supabase.from("configuracoes").upsert({ chave, valor, atualizado_em: agora, atualizado_por: userId })
      : await supabase.from("configuracoes").delete().eq("chave", chave);
    if (error) throw new Error(error.message);
  }
}

export const CONFIG = { CHAVE_API, CHAVE_MODELO, CHAVE_MODELO_CLASSIFICACAO };

/** Mostra só o final da chave. */
export function mascarar(chave: string) {
  return "••••••••" + chave.slice(-4);
}
