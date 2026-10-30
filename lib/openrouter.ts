import "server-only";

const BASE = "https://openrouter.ai/api/v1";

export type Citacao = { url: string; titulo: string };

export class ErroOpenRouter extends Error {}

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

export type InfoChave = {
  usoTotal: number;
  limiteRestante: number | null;
  gratuito: boolean;
};

/** Valida a chave e devolve uso/créditos. */
export async function verificarChave(apiKey: string): Promise<InfoChave> {
  const r = await fetch(`${BASE}/key`, { headers: cabecalhos(apiKey), signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new ErroOpenRouter(mensagemDeErro(r.status, await r.text()));
  const { data } = await r.json();
  return { usoTotal: data.usage ?? 0, limiteRestante: data.limit_remaining ?? null, gratuito: !!data.is_free_tier };
}

export type Modelo = { id: string; nome: string; criado: number };

/** Lista pública de modelos (não precisa de chave). */
export async function listarModelos(): Promise<Modelo[]> {
  const r = await fetch(`${BASE}/models`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) return [];
  const { data } = await r.json();
  return (data as { id: string; name: string; created: number }[])
    .map((m) => ({ id: m.id, nome: m.name, criado: m.created }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Modelo sugerido quando nenhum foi escolhido: o Claude Sonnet mais recente da lista. */
export function modeloPadrao(modelos: Modelo[]): string | null {
  const candidatos = modelos
    .filter((m) => m.id.startsWith("anthropic/claude-sonnet") && !m.id.includes(":"))
    .sort((a, b) => b.criado - a.criado);
  return candidatos[0]?.id ?? null;
}

export async function conversar({
  apiKey,
  modelo,
  sistema,
  usuario,
  buscaWeb,
}: {
  apiKey: string;
  modelo: string;
  sistema: string;
  usuario: string;
  buscaWeb?: { maxResultados: number };
}): Promise<{ texto: string; citacoes: Citacao[] }> {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: cabecalhos(apiKey),
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: usuario },
      ],
      temperature: 0.2,
      ...(buscaWeb ? { plugins: [{ id: "web", max_results: buscaWeb.maxResultados }] } : {}),
    }),
  });
  if (!r.ok) throw new ErroOpenRouter(mensagemDeErro(r.status, await r.text()));

  const json = await r.json();
  if (json.error) throw new ErroOpenRouter(json.error.message ?? "Erro desconhecido da OpenRouter.");
  const msg = json.choices?.[0]?.message;
  const citacoes: Citacao[] = (msg?.annotations ?? [])
    .filter((a: { type: string }) => a.type === "url_citation")
    .map((a: { url_citation: { url: string; title?: string } }) => ({
      url: a.url_citation.url,
      titulo: a.url_citation.title ?? a.url_citation.url,
    }));

  return { texto: msg?.content ?? "", citacoes };
}

/** Extrai o primeiro objeto JSON de uma resposta (tolera texto ou ```json em volta). */
export function extrairJson<T>(texto: string): T {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) throw new ErroOpenRouter("A IA não devolveu dados no formato esperado. Tente novamente.");
  try {
    return JSON.parse(texto.slice(inicio, fim + 1)) as T;
  } catch {
    throw new ErroOpenRouter("A IA não devolveu dados no formato esperado. Tente novamente.");
  }
}
