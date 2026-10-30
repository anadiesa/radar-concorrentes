import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCsv } from "./csv";

export type LinhaImportacao = {
  texto: string;
  data: string | null; // AAAA-MM-DD
  nota: number | null;
  url: string | null;
  cargo: string | null;
};

export type ResultadoImportacao = {
  novas: number;
  duplicadas: number;
  ignoradas: string[]; // mensagens sobre linhas descartadas
};

export const LIMITE_LINHAS = 2000;

// Nomes aceitos no cabeçalho do CSV (comparados sem acento e em minúsculas).
const COLUNAS: Record<keyof LinhaImportacao, string[]> = {
  texto: ["texto", "avaliacao", "comentario", "review", "text"],
  data: ["data", "date"],
  nota: ["nota", "rating", "estrelas", "score"],
  url: ["url", "link"],
  cargo: ["cargo", "autor_cargo", "segmento", "role"],
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Aceita AAAA-MM-DD, DD/MM/AAAA e DD/MM/AA. */
export function parseData(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return Number.isNaN(new Date(iso).getTime()) ? null : iso;
  }
  return null;
}

/** Nota padronizada em 0 a 5 (estrelas). Notas de 0 a 10 (ex.: Reclame Aqui) são divididas por 2. */
export function parseNota(v: string): number | null {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n > 5 ? Math.round(n * 5) / 10 : n;
}

/** Converte o CSV em linhas de importação. A coluna de texto é obrigatória. */
export function linhasDoCsv(conteudo: string): { linhas: LinhaImportacao[]; erro?: string; ignoradas: string[] } {
  const tabela = parseCsv(conteudo);
  if (tabela.length < 2) return { linhas: [], ignoradas: [], erro: "O CSV precisa ter cabeçalho e pelo menos uma linha." };

  const cabecalho = tabela[0].map(semAcento);
  const indice = Object.fromEntries(
    Object.entries(COLUNAS).map(([campo, nomes]) => [campo, cabecalho.findIndex((c) => nomes.includes(c))]),
  ) as Record<keyof LinhaImportacao, number>;

  if (indice.texto < 0) {
    return { linhas: [], ignoradas: [], erro: 'O CSV precisa de uma coluna "texto" com o conteúdo da avaliação.' };
  }

  const ignoradas: string[] = [];
  const linhas: LinhaImportacao[] = [];
  const valor = (l: string[], campo: keyof LinhaImportacao) => (indice[campo] >= 0 ? (l[indice[campo]] ?? "").trim() : "");

  tabela.slice(1).forEach((l, i) => {
    const n = i + 2; // número da linha no arquivo (1 = cabeçalho)
    const texto = valor(l, "texto");
    if (!texto) {
      ignoradas.push(`Linha ${n}: sem texto.`);
      return;
    }
    const dataBruta = valor(l, "data");
    const data = parseData(dataBruta);
    if (dataBruta && !data) ignoradas.push(`Linha ${n}: data "${dataBruta}" não reconhecida (importada sem data).`);
    const notaBruta = valor(l, "nota");
    const nota = parseNota(notaBruta);
    if (notaBruta && nota === null) ignoradas.push(`Linha ${n}: nota "${notaBruta}" inválida (importada sem nota).`);
    const url = valor(l, "url");

    linhas.push({
      texto,
      data,
      nota,
      url: /^https?:\/\//i.test(url) ? url : null,
      cargo: valor(l, "cargo") || null,
    });
  });

  return { linhas, ignoradas };
}

/** Avaliações coladas como texto: uma por bloco, separadas por linha em branco. */
export function linhasDoTexto(conteudo: string, data: string | null): LinhaImportacao[] {
  return conteudo
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((texto) => ({ texto, data, nota: null, url: null, cargo: null }));
}

/**
 * Grava as avaliações de uma fonte e registra a coleta. Duplicadas (mesmo texto normalizado
 * na mesma fonte) são ignoradas pelo banco via UNIQUE (fonte_id, hash).
 */
export async function importarAvaliacoes(
  supabase: SupabaseClient,
  fonte: { id: string; concorrente_id: string; url: string | null },
  linhas: LinhaImportacao[],
): Promise<{ novas: number; duplicadas: number; erro?: string }> {
  const { data: coleta } = await supabase
    .from("coletas")
    .insert({ fonte_id: fonte.id })
    .select("id")
    .single();

  // Todas as linhas com as mesmas chaves: o PostgREST usa a união das chaves do lote.
  const registros = linhas.map((l) => ({
    concorrente_id: fonte.concorrente_id,
    fonte_id: fonte.id,
    texto_original: l.texto,
    data: l.data,
    nota: l.nota,
    url_original: l.url ?? fonte.url,
    autor_cargo: l.cargo,
  }));

  const { data, error } = await supabase
    .from("avaliacoes")
    .upsert(registros, { onConflict: "fonte_id,hash", ignoreDuplicates: true })
    .select("id");

  const agora = new Date().toISOString();
  const novas = data?.length ?? 0;
  const duplicadas = error ? 0 : linhas.length - novas;

  if (coleta) {
    await supabase
      .from("coletas")
      .update({ finalizada_em: agora, status: error ? "erro" : "sucesso", novas, duplicadas, erro: error?.message ?? null })
      .eq("id", coleta.id);
  }
  await supabase
    .from("fontes")
    .update({ ultima_coleta: agora, status_ultima_coleta: error ? "erro" : "sucesso" })
    .eq("id", fonte.id);

  return { novas, duplicadas, erro: error?.message };
}
