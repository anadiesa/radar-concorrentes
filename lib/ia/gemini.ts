import "server-only";
import { dominioDe, ErroIA, type Citacao, type Modelo, type PedidoConversa, type RespostaConversa } from "./comum";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function mensagemDeErro(status: number, corpo: string) {
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(corpo)) return "Chave do Gemini inválida.";
  if (status === 401 || status === 403) return "Chave do Gemini inválida ou sem acesso à Gemini API.";
  if (status === 404) return "Modelo não encontrado no Gemini. Confira o modelo em Configurações.";
  if (status === 429) return "Cota gratuita do Gemini atingida. Tente mais tarde ou use outro provedor.";
  return `Erro do Gemini (${status}): ${corpo.slice(0, 200)}`;
}

// Os modelos do Gemini "pensam" antes de responder e esse pensamento conta no limite de saída.
// Como a cota é gratuita, damos folga para a resposta não ser cortada.
const limite = (maxTokens: number) => Math.max(maxTokens * 4, 8192);

export async function listarModelos(apiKey: string): Promise<Modelo[]> {
  const r = await fetch(`${BASE}/models?pageSize=200`, {
    headers: { "x-goog-api-key": apiKey },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new ErroIA(mensagemDeErro(r.status, await r.text()));
  const json = await r.json();
  return ((json.models ?? []) as { name: string; displayName?: string; supportedGenerationMethods?: string[] }[])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /gemini/i.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ""), nome: m.displayName ?? m.name, criado: 0 }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function verificar(apiKey: string): Promise<string> {
  const modelos = await listarModelos(apiKey);
  return `Conexão OK. ${modelos.length} modelos Gemini disponíveis para esta chave.`;
}

/** Versão numérica do nome (ex.: "gemini-3.8-flash" → 3.8) para escolher o mais novo. */
const versao = (id: string) => Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);

/** O Flash estável mais novo (sem preview/lite/imagem/áudio): bom equilíbrio entre qualidade e cota. */
export function sugerir(modelos: Modelo[]) {
  const flash = modelos
    .filter((m) => /^gemini-[\d.]+-flash$/.test(m.id))
    .sort((a, b) => versao(b.id) - versao(a.id));
  return flash[0]?.id ?? modelos.find((m) => /flash/.test(m.id))?.id ?? null;
}

/** Sem busca: endpoint compatível com OpenAI. */
async function conversarSimples(apiKey: string, p: PedidoConversa): Promise<RespostaConversa> {
  const r = await fetch(`${BASE}/openai/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: p.modelo,
      messages: [
        { role: "system", content: p.sistema },
        { role: "user", content: p.usuario },
      ],
      temperature: 0.2,
      max_tokens: limite(p.maxTokens),
    }),
  });
  if (!r.ok) throw new ErroIA(mensagemDeErro(r.status, await r.text()));
  const json = await r.json();
  const escolha = Array.isArray(json) ? json[0]?.choices?.[0] : json.choices?.[0];
  const texto = String(escolha?.message?.content ?? "");
  if (escolha?.finish_reason === "length" && !texto.trim().endsWith("}")) {
    throw new ErroIA(`A resposta do modelo ${p.modelo} foi cortada antes do fim. Tente outro modelo em Configurações.`);
  }
  return { texto, citacoes: [], custoUsd: null };
}

/** Com busca: API nativa com a ferramenta google_search. */
async function conversarComBusca(apiKey: string, p: PedidoConversa): Promise<RespostaConversa> {
  const r = await fetch(`${BASE}/models/${encodeURIComponent(p.modelo)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [{ role: "user", parts: [{ text: p.usuario }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: limite(p.maxTokens) },
    }),
  });
  if (!r.ok) throw new ErroIA(mensagemDeErro(r.status, await r.text()));
  const json = await r.json();
  const cand = json.candidates?.[0];
  const texto = ((cand?.content?.parts ?? []) as { text?: string; thought?: boolean }[])
    .filter((x) => x.text && !x.thought)
    .map((x) => x.text)
    .join("");
  if (cand?.finishReason === "MAX_TOKENS" && !texto.trim().endsWith("}")) {
    throw new ErroIA(`A resposta do modelo ${p.modelo} foi cortada antes do fim. Tente outro modelo em Configurações.`);
  }

  // As URIs da busca do Google costumam ser links de redirecionamento; o título traz o domínio real.
  const citacoes: Citacao[] = ((cand?.groundingMetadata?.groundingChunks ?? []) as { web?: { uri?: string; title?: string } }[])
    .filter((c) => c.web?.uri)
    .map((c) => {
      const url = c.web!.uri!;
      const redirecionada = /vertexaisearch|grounding-api-redirect/.test(url);
      const titulo = c.web!.title ?? url;
      return { url, titulo, dominio: redirecionada ? titulo.replace(/^www\./, "") : dominioDe(url), redirecionada };
    });

  return { texto, citacoes, custoUsd: null };
}

export async function conversar(apiKey: string, p: PedidoConversa): Promise<RespostaConversa> {
  return p.buscaWeb ? conversarComBusca(apiKey, p) : conversarSimples(apiKey, p);
}
