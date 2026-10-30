// Tipos e utilitários compartilhados pelos provedores de IA.

export type Provedor = "openrouter" | "cloudflare" | "gemini";

export const PROVEDORES: Record<Provedor, { nome: string; buscaWeb: boolean; descricao: string }> = {
  openrouter: {
    nome: "OpenRouter",
    buscaWeb: true,
    descricao: "Centenas de modelos pagos (Claude, DeepSeek, GPT…) com uma chave só. Cobra por uso, em dólar.",
  },
  cloudflare: {
    nome: "Cloudflare Workers AI",
    buscaWeb: false,
    descricao: "10.000 neurônios grátis por dia (algumas centenas de avaliações). Sem busca na web.",
  },
  gemini: {
    nome: "Google Gemini",
    buscaWeb: true,
    descricao: "Cota gratuita diária e busca no Google. No plano grátis, o Google pode usar os textos enviados para melhorar os modelos.",
  },
};

export type Credenciais = {
  openrouter?: { apiKey: string };
  cloudflare?: { accountId: string; apiToken: string };
  gemini?: { apiKey: string };
};

export type Citacao = {
  url: string;
  titulo: string;
  /** Domínio da página citada (quando a URL é um link de redirecionamento, vem do título). */
  dominio: string;
  /** true quando a URL é um redirecionamento (ex.: Gemini) e só o domínio é confiável. */
  redirecionada?: boolean;
};

export type Modelo = { id: string; nome: string; criado: number };

export type PedidoConversa = {
  modelo: string;
  sistema: string;
  usuario: string;
  /** Limite da resposta. Sem ele alguns provedores reservam o custo máximo do modelo. */
  maxTokens: number;
  /** Pede ao modelo para não "pensar" antes (modelos de raciocínio gastam o limite pensando). */
  semRaciocinio?: boolean;
  buscaWeb?: { maxResultados: number };
};

export type RespostaConversa = { texto: string; citacoes: Citacao[]; custoUsd: number | null };

export class ErroIA extends Error {}

export function dominioDe(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Extrai o primeiro objeto JSON de uma resposta (tolera texto ou ```json em volta). */
export function extrairJson<T>(texto: string): T {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) throw new ErroIA("A IA não devolveu dados no formato esperado. Tente novamente.");
  try {
    return JSON.parse(texto.slice(inicio, fim + 1)) as T;
  } catch {
    throw new ErroIA("A IA não devolveu dados no formato esperado. Tente novamente.");
  }
}
