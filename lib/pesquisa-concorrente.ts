import "server-only";
import { getOpenRouter } from "@/lib/config";
import { conversar, ErroOpenRouter, extrairJson, type Citacao } from "@/lib/openrouter";
import { TIPOS_FONTE, type TipoFonte } from "@/lib/rotulos";

export type CampoPesquisado = { valor: string; fonte: string | null };

export type SugestaoConcorrente = {
  campos: Partial<Record<CampoSugerido, CampoPesquisado>>;
  fontesAvaliacao: { tipo: TipoFonte; url: string; confirmada: boolean }[];
  citacoes: Citacao[];
  modelo: string;
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
- Cuidado com empresas de nomes parecidos: confirme que é o software certo pelo segmento.
- Não inclua dados pessoais de pessoas físicas.`;

function instrucoes(nome: string, site: string | null, segmento: string | null) {
  return `Pesquise o software/empresa concorrente "${nome}"${site ? ` (site: ${site})` : ""}${
    segmento ? `, do segmento "${segmento}"` : ""
  }.

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
Em "fontes_avaliacao", liste apenas páginas de avaliações que você realmente encontrou (Reclame Aqui, B2B Stack, Capterra, G2, Google Play, App Store).`;
}

const urlValida = (u: unknown): u is string => typeof u === "string" && /^https?:\/\/[^\s]+$/i.test(u);
const normalizarUrl = (u: string) => u.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();

export async function pesquisarConcorrente(
  nome: string,
  site: string | null,
  segmento: string | null,
): Promise<SugestaoConcorrente> {
  const config = await getOpenRouter();
  if (!config) throw new ErroOpenRouter("Configure a chave da OpenRouter em Administração → Configurações.");
  if (!config.modelo) throw new ErroOpenRouter("Escolha o modelo de IA em Administração → Configurações.");

  const { texto, citacoes } = await conversar({
    apiKey: config.apiKey,
    modelo: config.modelo,
    sistema: SISTEMA,
    usuario: instrucoes(nome, site, segmento),
    buscaWeb: { maxResultados: 8 },
  });

  const bruto = extrairJson<Record<string, unknown>>(texto);
  const citadas = new Set(citacoes.map((c) => normalizarUrl(c.url)));

  const campos: SugestaoConcorrente["campos"] = {};
  for (const campo of CAMPOS_SUGERIDOS) {
    const v = bruto[campo] as { valor?: unknown; fonte?: unknown } | null | undefined;
    if (!v || v.valor === null || v.valor === undefined || String(v.valor).trim() === "") continue;
    const valor = String(v.valor).trim();
    if (campo === "site" && !urlValida(valor)) continue;
    campos[campo] = { valor, fonte: urlValida(v.fonte) ? v.fonte : null };
  }

  const vistas = new Set<string>();
  const fontesAvaliacao: SugestaoConcorrente["fontesAvaliacao"] = [];
  for (const f of (Array.isArray(bruto.fontes_avaliacao) ? bruto.fontes_avaliacao : []) as { tipo?: string; url?: unknown }[]) {
    if (!urlValida(f.url) || !f.tipo || !(f.tipo in TIPOS_FONTE)) continue;
    const chave = normalizarUrl(f.url);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    // "confirmada" = a URL apareceu nos resultados reais da busca, não só no texto do modelo.
    fontesAvaliacao.push({ tipo: f.tipo as TipoFonte, url: f.url, confirmada: citadas.has(chave) });
  }

  return { campos, fontesAvaliacao, citacoes, modelo: config.modelo, pesquisadoEm: new Date().toISOString() };
}
