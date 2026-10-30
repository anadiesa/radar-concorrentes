import "server-only";
import { ErroIA, type Modelo, type PedidoConversa, type RespostaConversa } from "./comum";

type Cred = { accountId: string; apiToken: string };

const base = (c: Cred) => `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(c.accountId)}/ai`;
const cabecalhos = (c: Cred) => ({ Authorization: `Bearer ${c.apiToken}`, "Content-Type": "application/json" });

function mensagemDeErro(status: number, corpo: string) {
  if (status === 401 || status === 403 || /Authentication|Unauthorized|"code":\s*(9106|10000)/i.test(corpo)) {
    return "Token da Cloudflare inválido ou sem permissão de Workers AI. Confira o Account ID e o token.";
  }
  if (status === 404) return "Conta ou modelo não encontrado na Cloudflare. Confira o Account ID e o modelo.";
  if (status === 429 || /neuron|daily|quota|limit/i.test(corpo)) {
    return "Cota gratuita diária da Cloudflare Workers AI esgotada (10.000 neurônios). Volta amanhã ou use outro provedor.";
  }
  return `Erro da Cloudflare (${status}): ${corpo.slice(0, 200)}`;
}

/** Modelos de geração de texto da conta. Também serve para validar Account ID + token. */
export async function listarModelos(c: Cred): Promise<Modelo[]> {
  const r = await fetch(`${base(c)}/models/search?task=${encodeURIComponent("Text Generation")}&per_page=100`, {
    headers: cabecalhos(c),
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new ErroIA(mensagemDeErro(r.status, await r.text()));
  const json = await r.json();
  return ((json.result ?? []) as { name: string; description?: string; created_at?: string }[])
    .map((m) => ({ id: m.name, nome: m.name.replace(/^@cf\//, ""), criado: m.created_at ? Date.parse(m.created_at) / 1000 : 0 }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function verificar(c: Cred): Promise<string> {
  const modelos = await listarModelos(c);
  return `Conexão OK. ${modelos.length} modelos de texto disponíveis. Cota grátis: 10.000 neurônios por dia.`;
}

/** Classificação: um modelo de instrução sem "raciocínio" (rápido e econômico em neurônios). */
export function sugerirClassificacao(modelos: Modelo[]) {
  const preferidos = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/mistralai/mistral-small-3.1-24b-instruct",
    "@cf/meta/llama-3.1-8b-instruct-fast",
  ];
  const ids = new Set(modelos.map((m) => m.id));
  return preferidos.find((p) => ids.has(p)) ?? modelos.find((m) => /instruct/.test(m.id))?.id ?? modelos[0]?.id ?? null;
}

export async function conversar(c: Cred, p: PedidoConversa): Promise<RespostaConversa> {
  if (p.buscaWeb) throw new ErroIA("A Cloudflare Workers AI não faz busca na web. Escolha outro provedor para a pesquisa.");

  const r = await fetch(`${base(c)}/v1/chat/completions`, {
    method: "POST",
    headers: cabecalhos(c),
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: p.modelo,
      messages: [
        { role: "system", content: p.sistema },
        { role: "user", content: p.usuario },
      ],
      temperature: 0.2,
      max_tokens: p.maxTokens,
    }),
  });
  if (!r.ok) throw new ErroIA(mensagemDeErro(r.status, await r.text()));

  const json = await r.json();
  const escolha = json.choices?.[0];
  const texto = String(escolha?.message?.content ?? "");
  if (escolha?.finish_reason === "length" && !texto.trim().endsWith("}")) {
    throw new ErroIA(`A resposta do modelo ${p.modelo} foi cortada antes do fim. Tente outro modelo em Configurações.`);
  }
  // Custo em dinheiro não se aplica: consome a cota diária de neurônios.
  return { texto, citacoes: [], custoUsd: null };
}
