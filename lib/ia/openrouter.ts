import "server-only";
import { dominioDe, ErroIA, type Citacao, type Modelo, type PedidoConversa, type RespostaConversa } from "./comum";

const BASE = "https://openrouter.ai/api/v1";

function cabecalhos(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    "X-Title": "Radar de Concorrentes",
  };
}

function mensagemDeErro(status: number, corpo: string) {
  if (status === 401) return "Chave da OpenRouter inválida ou revogada.";
  if (status === 402) return "Sem créditos na OpenRouter. Adicione créditos em openrouter.ai/settings/credits.";
  if (status === 429) return "Limite de requisições da OpenRouter atingido. Tente novamente em instantes.";
  if (status === 404) return "Modelo não encontrado na OpenRouter. Confira o modelo em Configurações.";
  return `Erro da OpenRouter (${status}): ${corpo.slice(0, 200)}`;
}

/** Valida a chave e descreve uso/créditos. */
export async function verificar(apiKey: string): Promise<string> {
  const r = await fetch(`${BASE}/key`, { headers: cabecalhos(apiKey), signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new ErroIA(mensagemDeErro(r.status, await r.text()));
  const { data } = await r.json();
  const saldo =
    data.limit_remaining == null ? "sem limite definido na chave" : `US$ ${Number(data.limit_remaining).toFixed(2)} restantes no limite da chave`;
  return `Conexão OK. Uso total da chave: US$ ${Number(data.usage ?? 0).toFixed(2)} · ${saldo}.`;
}

/** Lista pública de modelos (não precisa de chave). */
export async function listarModelos(): Promise<Modelo[]> {
  const r = await fetch(`${BASE}/models`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r?.ok) return [];
  const { data } = await r.json();
  return (data as { id: string; name: string; created: number }[])
    .map((m) => ({ id: m.id, nome: m.name, criado: m.created }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const maisRecente = (modelos: Modelo[], prefixo: string) =>
  modelos.filter((m) => m.id.startsWith(prefixo) && !m.id.includes(":")).sort((a, b) => b.criado - a.criado)[0]?.id ?? null;

/** Pesquisa: o Claude Sonnet mais recente (bom em português e em seguir o formato pedido). */
export function sugerirPesquisa(modelos: Modelo[]) {
  return maisRecente(modelos, "anthropic/claude-sonnet");
}

/**
 * Classificação. Testado em out/2026 com avaliações de restaurantes: DeepSeek V4 Flash acertou
 * todas por ~US$ 0,00004/avaliação. Cai no Haiku e depois no modelo de pesquisa.
 */
export function sugerirClassificacao(modelos: Modelo[]) {
  if (modelos.some((m) => m.id === "deepseek/deepseek-v4-flash")) return "deepseek/deepseek-v4-flash";
  return maisRecente(modelos, "anthropic/claude-haiku") ?? sugerirPesquisa(modelos);
}

export async function conversar(apiKey: string, p: PedidoConversa): Promise<RespostaConversa> {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: cabecalhos(apiKey),
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: p.modelo,
      messages: [
        { role: "system", content: p.sistema },
        { role: "user", content: p.usuario },
      ],
      temperature: 0.2,
      max_tokens: p.maxTokens,
      usage: { include: true },
      ...(p.semRaciocinio ? { reasoning: { enabled: false } } : {}),
      // Busca via Exa (US$ 0,007 por busca, uma busca por chamada). A busca "nativa" do provedor
      // pode fazer várias buscas e encher o contexto, ficando bem mais cara.
      ...(p.buscaWeb ? { plugins: [{ id: "web", engine: "exa", max_results: p.buscaWeb.maxResultados }] } : {}),
    }),
  });
  if (!r.ok) throw new ErroIA(mensagemDeErro(r.status, await r.text()));

  const json = await r.json();
  if (json.error) throw new ErroIA(json.error.message ?? "Erro desconhecido da OpenRouter.");
  const escolha = json.choices?.[0];
  const msg = escolha?.message;
  if (escolha?.finish_reason === "length" && !String(msg?.content ?? "").trim().endsWith("}")) {
    throw new ErroIA(`A resposta do modelo ${p.modelo} foi cortada antes do fim. Tente outro modelo em Configurações.`);
  }
  const citacoes: Citacao[] = (msg?.annotations ?? [])
    .filter((a: { type: string }) => a.type === "url_citation")
    .map((a: { url_citation: { url: string; title?: string } }) => ({
      url: a.url_citation.url,
      titulo: a.url_citation.title ?? a.url_citation.url,
      dominio: dominioDe(a.url_citation.url),
    }));

  const custo = json.usage?.cost;
  return { texto: msg?.content ?? "", citacoes, custoUsd: typeof custo === "number" ? custo : null };
}
