import "server-only";
import { getTarefa } from "@/lib/config";
import { conversar, ErroIA, extrairJson, PROVEDORES, type Citacao } from "@/lib/ia";
import { TIPOS_FONTE, type TipoFonte } from "@/lib/rotulos";

export type CampoPesquisado = { valor: string; fonte: string | null; obs: string | null };

export type SugestaoConcorrente = {
  campos: Partial<Record<CampoSugerido, CampoPesquisado>>;
  fontesAvaliacao: { tipo: TipoFonte; url: string; confirmada: boolean }[];
  citacoes: Citacao[];
  modelo: string;
  custoUsd: number | null;
  pesquisadoEm: string;
};

export const CAMPOS_SUGERIDOS = [
  "site",
  "segmento",
  "observacoes",
  "tempo_de_mercado",
  "funcionarios",
  "vagas_abertas",
  "nota_glassdoor",
  "reputacao_reclame_aqui",
  "ultimo_investimento",
] as const;
export type CampoSugerido = (typeof CAMPOS_SUGERIDOS)[number];

const SISTEMA = `Você é um analista de inteligência competitiva no Brasil. Pesquise na web e responda SOMENTE com um objeto JSON, sem texto antes ou depois.
Regras:
- Use apenas informações encontradas na pesquisa. Se não encontrar um dado com confiança, use null. Nunca invente.
- Para cada campo, informe "fonte": a URL exata da página onde o dado foi encontrado.
- "valor" deve ser CURTO e direto (no máximo 80 caracteres), sem explicações. Ressalvas, divergências entre fontes ou contexto vão em "obs" (opcional, até 200 caracteres).
- Cuidado com empresas de nomes parecidos: confirme que é o software certo pelo segmento.
- Não inclua dados pessoais de pessoas físicas.`;

// A busca web usa a mensagem do usuário como termo de pesquisa: por isso ela é curta e focada,
// e o formato da resposta vai junto das regras, na mensagem de sistema.
function termoDeBusca(nome: string, site: string | null, segmento: string | null) {
  const dominio = site ? new URL(site).hostname.replace(/^www\./, "") : null;
  return [
    `"${nome}"`,
    segmento ?? "software",
    dominio,
    "empresa fundação funcionários investimento",
    "avaliações Reclame Aqui Capterra Google Play",
  ]
    .filter(Boolean)
    .join(" ");
}

function formato(nome: string, site: string | null, segmento: string | null) {
  return `Empresa pesquisada: "${nome}"${site ? ` (site: ${site})` : ""}${segmento ? `, segmento "${segmento}"` : ""}.

Devolva exatamente este JSON (valores em português do Brasil):
{
  "site": {"valor": "URL oficial", "fonte": "url"} | null,
  "segmento": {"valor": "segmento em poucas palavras", "fonte": "url"} | null,
  "observacoes": {"valor": "2 a 3 frases: o que o produto faz, público-alvo e diferenciais anunciados", "fonte": "url"} | null,
  "tempo_de_mercado": {"valor": "ex.: 12 anos (fundada em 2014)", "fonte": "url"} | null,
  "funcionarios": {"valor": "faixa, ex.: 51–200", "fonte": "url"} | null,
  "vagas_abertas": {"valor": "número inteiro", "fonte": "url"} | null,
  "nota_glassdoor": {"valor": "número de 0 a 5", "fonte": "url"} | null,
  "reputacao_reclame_aqui": {"valor": "selo e nota, ex.: Bom (7,4)", "fonte": "url"} | null,
  "ultimo_investimento": {"valor": "rodada, valor e ano, ex.: Série A R$ 40 mi (2025)", "fonte": "url"} | null,
  "fontes_avaliacao": [
    {"tipo": "${Object.keys(TIPOS_FONTE).join(" | ")}", "url": "URL da página de avaliações deste produto"}
  ]
}
Cada campo pode ter também "obs" com ressalvas, ex.: {"valor": "51–200", "fonte": "url", "obs": "o site cita mais de 400"}.
Em "fontes_avaliacao", liste apenas páginas com avaliações de CLIENTES sobre o produto que você realmente encontrou (Reclame Aqui, B2B Stack, Capterra, G2, GetApp, Google Play, App Store). NÃO inclua Glassdoor, LinkedIn, Indeed ou outras avaliações de funcionários.`;
}

const urlValida = (u: unknown): u is string => typeof u === "string" && /^https?:\/\/[^\s]+$/i.test(u);
const normalizarUrl = (u: string) => u.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();

// Avaliações de funcionários não servem como fonte de avaliação do produto.
const DOMINIOS_FUNCIONARIOS = /(^|\.)(glassdoor\.[a-z.]+|linkedin\.com|indeed\.[a-z.]+|lovemondays\.com\.br)$/i;

/** Ajustes de URL: Reclame Aqui na página principal e Google Play em português. */
function ajustarUrlFonte(url: string) {
  try {
    const u = new URL(url);
    if (DOMINIOS_FUNCIONARIOS.test(u.hostname)) return null;
    // Reclame Aqui: sempre a página principal da empresa (não /sobre/, /lista-reclamacoes/ etc.).
    const ra = u.hostname.endsWith("reclameaqui.com.br") && u.pathname.match(/^\/empresa\/([^/]+)/);
    if (ra) return `https://www.reclameaqui.com.br/empresa/${ra[1]}/`;
    if (u.hostname === "play.google.com" && u.searchParams.get("id")) {
      return `https://play.google.com/store/apps/details?id=${u.searchParams.get("id")}&hl=pt_BR`;
    }
    return url;
  } catch {
    return null;
  }
}

export async function pesquisarConcorrente(
  nome: string,
  site: string | null,
  segmento: string | null,
): Promise<SugestaoConcorrente> {
  const tarefa = await getTarefa("pesquisa");
  if (!tarefa) throw new ErroIA("Configure o provedor e o modelo da pesquisa em Administração → Configurações.");

  const { texto, citacoes, custoUsd } = await conversar(tarefa, {
    sistema: `${SISTEMA}

${formato(nome, site, segmento)}`,
    usuario: termoDeBusca(nome, site, segmento),
    maxTokens: 2500,
    // Na OpenRouter, a Exa cobra o mesmo valor por busca até 10 resultados.
    buscaWeb: { maxResultados: 10 },
  });

  const bruto = extrairJson<Record<string, unknown>>(texto);
  const citadas = new Set(citacoes.map((c) => normalizarUrl(c.url)));
  // Quando a busca devolve links de redirecionamento (Gemini), só dá para confirmar pelo domínio.
  const dominiosRedirecionados = new Set(citacoes.filter((c) => c.redirecionada).map((c) => c.dominio.toLowerCase()));
  const confirmada = (url: string) => {
    if (citadas.has(normalizarUrl(url))) return true;
    try {
      return dominiosRedirecionados.has(new URL(url).hostname.replace(/^www\./, "").toLowerCase());
    } catch {
      return false;
    }
  };

  const campos: SugestaoConcorrente["campos"] = {};
  for (const campo of CAMPOS_SUGERIDOS) {
    const v = bruto[campo] as { valor?: unknown; fonte?: unknown; obs?: unknown } | null | undefined;
    if (!v || v.valor === null || v.valor === undefined || String(v.valor).trim() === "") continue;
    const valor = String(v.valor).trim();
    if (campo === "site" && !urlValida(valor)) continue;
    const obs = typeof v.obs === "string" && v.obs.trim() ? v.obs.trim().slice(0, 300) : null;
    campos[campo] = { valor, fonte: urlValida(v.fonte) ? v.fonte : null, obs };
  }

  const vistas = new Set<string>();
  const fontesAvaliacao: SugestaoConcorrente["fontesAvaliacao"] = [];
  for (const f of (Array.isArray(bruto.fontes_avaliacao) ? bruto.fontes_avaliacao : []) as { tipo?: string; url?: unknown }[]) {
    if (!urlValida(f.url) || !f.tipo || !(f.tipo in TIPOS_FONTE)) continue;
    const url = ajustarUrlFonte(f.url);
    if (!url) continue;
    const chave = normalizarUrl(url);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    // "confirmada" = a URL apareceu nos resultados reais da busca, não só no texto do modelo.
    fontesAvaliacao.push({ tipo: f.tipo as TipoFonte, url, confirmada: confirmada(f.url) });
  }

  return {
    campos,
    fontesAvaliacao,
    citacoes,
    modelo: `${PROVEDORES[tarefa.provedor].nome} · ${tarefa.modelo}`,
    custoUsd,
    pesquisadoEm: new Date().toISOString(),
  };
}
