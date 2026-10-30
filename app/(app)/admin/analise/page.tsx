import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatarData, TIPOS_FONTE } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";
import { CartaoClassificacao, type AvaliacaoPendente } from "./cartao-classificacao";

export const metadata = { title: "Classificar avaliações · Radar de Concorrentes" };

const POR_PAGINA = 10;

export default async function AnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ concorrente?: string }>;
}) {
  await requireAdmin();
  const { concorrente } = await searchParams;
  const supabase = await createClient();

  // Pendentes = avaliações sem linha em `analises` (left join com filtro de nulo).
  let consulta = supabase
    .from("avaliacoes")
    .select(
      "id, texto_original, nota, data, url_original, autor_cargo, coletada_em, concorrente_id, concorrentes(nome), fontes(tipo), analises!left(avaliacao_id)",
      { count: "exact" },
    )
    .is("analises", null)
    .order("coletada_em", { ascending: true })
    .limit(POR_PAGINA);
  if (concorrente) consulta = consulta.eq("concorrente_id", concorrente);

  const [{ data, count, error }, { data: temas }, { data: concorrentes }] = await Promise.all([
    consulta,
    supabase.from("temas").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("concorrentes").select("id, nome").order("nome"),
  ]);

  const pendentes: AvaliacaoPendente[] =
    data?.map((a) => ({
      id: a.id,
      texto_original: a.texto_original,
      nota: a.nota,
      data: a.data ? formatarData(a.data) : null,
      url_original: a.url_original,
      autor_cargo: a.autor_cargo,
      concorrente: (a.concorrentes as unknown as { nome: string }).nome,
      fonte: TIPOS_FONTE[(a.fontes as unknown as { tipo: keyof typeof TIPOS_FONTE }).tipo],
      coletada_em: formatarData(a.coletada_em),
    })) ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-marinho">Classificar avaliações</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {count ?? 0} avaliação(ões) aguardando classificação. Cada uma é classificada uma única vez.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" aria-label="Filtrar por concorrente">
        <div>
          <label htmlFor="filtro-concorrente" className="rotulo">Concorrente</label>
          <select id="filtro-concorrente" name="concorrente" defaultValue={concorrente ?? ""} className="campo w-auto">
            <option value="">Todos</option>
            {concorrentes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secundario">Filtrar</button>
      </form>

      {error && <p role="alert" className="text-sm text-laranja">Erro ao carregar: {error.message}</p>}

      {pendentes.length === 0 ? (
        <div className="cartao text-sm">
          <p>Nada pendente. 🎉</p>
          <Link href="/admin/fontes" className="mt-2 inline-block text-azul underline">Importar mais avaliações</Link>
        </div>
      ) : (
        <>
          {pendentes.map((a) => (
            <CartaoClassificacao key={a.id} avaliacao={a} temas={temas ?? []} />
          ))}
          {(count ?? 0) > POR_PAGINA && (
            <Link href={concorrente ? `/admin/analise?concorrente=${concorrente}` : "/admin/analise"} className="btn-secundario">
              Carregar as próximas
            </Link>
          )}
        </>
      )}
    </div>
  );
}
