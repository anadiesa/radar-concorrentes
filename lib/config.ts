import "server-only";
import { PROVEDORES, type ConfigTarefa, type Credenciais, type Provedor, type Tarefa } from "@/lib/ia";
import { createAdminClient } from "@/lib/supabase/server";

// Nomes das chaves na tabela `configuracoes`.
export const CONFIG = {
  OPENROUTER_API_KEY: "openrouter_api_key",
  CLOUDFLARE_ACCOUNT_ID: "cloudflare_account_id",
  CLOUDFLARE_API_TOKEN: "cloudflare_api_token",
  GEMINI_API_KEY: "gemini_api_key",
  provedor: (t: Tarefa) => `ia_${t}_provedor`,
  modelo: (t: Tarefa) => `ia_${t}_modelo`,
} as const;

export type OrigemCredencial = "ambiente" | "sistema";

export type ConfigIA = {
  credenciais: Credenciais;
  origem: Partial<Record<Provedor, OrigemCredencial>>;
  tarefas: Record<Tarefa, { provedor: Provedor | null; modelo: string | null }>;
};

async function lerTudo() {
  const { data } = await createAdminClient().from("configuracoes").select("chave, valor");
  return Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor])) as Record<string, string | undefined>;
}

/**
 * Configuração de IA. Variáveis de ambiente (OPENROUTER_API_KEY, CLOUDFLARE_ACCOUNT_ID +
 * CLOUDFLARE_API_TOKEN, GEMINI_API_KEY) têm prioridade sobre o que foi salvo na tela.
 */
export async function getConfigIA(): Promise<ConfigIA> {
  const s = await lerTudo();
  const env = process.env;
  const credenciais: Credenciais = {};
  const origem: ConfigIA["origem"] = {};

  if (env.OPENROUTER_API_KEY || s[CONFIG.OPENROUTER_API_KEY]) {
    credenciais.openrouter = { apiKey: env.OPENROUTER_API_KEY || s[CONFIG.OPENROUTER_API_KEY]! };
    origem.openrouter = env.OPENROUTER_API_KEY ? "ambiente" : "sistema";
  }
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
    credenciais.cloudflare = { accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_API_TOKEN };
    origem.cloudflare = "ambiente";
  } else if (s[CONFIG.CLOUDFLARE_ACCOUNT_ID] && s[CONFIG.CLOUDFLARE_API_TOKEN]) {
    credenciais.cloudflare = { accountId: s[CONFIG.CLOUDFLARE_ACCOUNT_ID]!, apiToken: s[CONFIG.CLOUDFLARE_API_TOKEN]! };
    origem.cloudflare = "sistema";
  }
  if (env.GEMINI_API_KEY || s[CONFIG.GEMINI_API_KEY]) {
    credenciais.gemini = { apiKey: env.GEMINI_API_KEY || s[CONFIG.GEMINI_API_KEY]! };
    origem.gemini = env.GEMINI_API_KEY ? "ambiente" : "sistema";
  }

  const tarefa = (t: Tarefa) => {
    const p = s[CONFIG.provedor(t)];
    return { provedor: p && p in PROVEDORES ? (p as Provedor) : null, modelo: s[CONFIG.modelo(t)] ?? null };
  };
  return { credenciais, origem, tarefas: { pesquisa: tarefa("pesquisa"), classificacao: tarefa("classificacao") } };
}

/** Configuração pronta para rodar uma tarefa, ou null se faltar provedor, modelo ou credencial. */
export async function getTarefa(t: Tarefa): Promise<ConfigTarefa | null> {
  const c = await getConfigIA();
  const { provedor, modelo } = c.tarefas[t];
  if (!provedor || !modelo || !c.credenciais[provedor]) return null;
  if (t === "pesquisa" && !PROVEDORES[provedor].buscaWeb) return null;
  return { provedor, modelo, credenciais: c.credenciais };
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

/** Mostra só o final da chave. */
export function mascarar(chave: string) {
  return "••••••••" + chave.slice(-4);
}
