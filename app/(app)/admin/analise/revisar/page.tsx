import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatarData, TIPOS_FONTE } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";
import { CartaoClassificacao, type AvaliacaoPendente } from "../cartao-classificacao";

export const metadata = { title: "Revisar classificações da IA · Radar de Concorrentes" };

const POR_PAGINA = 10;

export default async function RevisarPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data, count, error }, { data: temas }] = await Promise.all([
    supabase
      .from("analises")
      .select(
        "sentimento, resumo_curto, modelo, analise_temas(tema_id), avaliacoes!inner(id, texto_original, nota, data, url_original, autor_cargo, coletada_em, concorrentes(nome), fontes(tipo))",
        { count: "exact" },
      )
      .is("revisado_em", null)
      .order("analisado_em", { ascending: true })
      .limit(POR_PAGINA),
    supabase.from("temas").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  type Linha = {
    sentimento: string;
    resumo_curto: string;
    modelo: string;
    analise_temas: { tema_id: string }[];
    avaliacoes: {
      id: string;
      texto_original: string;
      nota: number | null;
      data: string | null;
      url_original: string | null;
      autor_cargo: string | null;
      coletada_em: string;
      concorrentes: { nome: string };
      fontes: { tipo: keyof typeof TIPOS_FONTE };
    };
  };

  const itens: AvaliacaoPendente[] = ((data ?? []) as unknown as Linha[]).map((l) => ({
    id: l.avaliacoes.id,
    texto_original: l.avaliacoes.texto_original,
    nota: l.avaliacoes.nota,
    data: l.avaliacoes.data ? formatarData(l.avaliacoes.data) : null,
    url_original: l.avaliacoes.url_original,
    autor_cargo: l.avaliacoes.autor_cargo,
    concorrente: l.avaliacoes.concorrentes.nome,
    fonte: TIPOS_FONTE[l.avaliacoes.fontes.tipo],
    coletada_em: formatarData(l.avaliacoes.coletada_em),
    analise: {
      sentimento: l.sentimento,
      temas: l.analise_temas.map((t) => t.tema_id),
      resumo: l.resumo_curto,
      modelo: l.modelo,
    },
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/analise" className="text-sm text-azul underline">← Classificar avaliações</Link>
        <h1 className="mt-2 text-2xl font-semibold text-marinho">Revisar classificações da IA</h1>
        <p className="mt-1 text-sm text-texto-suave">
          {count ?? 0} classificação(ões) aguardando revisão. Já contam no painel; a revisão serve para corrigir erros da IA.
          Se estiver certo, clique em <strong>Confirmar</strong>.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-laranja">Erro ao carregar: {error.message}</p>}

      {itens.length === 0 ? (
        <div className="cartao text-sm">Nada para revisar.</div>
      ) : (
        <>
          {itens.map((a) => (
            <CartaoClassificacao key={a.id} avaliacao={a} temas={temas ?? []} />
          ))}
          {(count ?? 0) > POR_PAGINA && (
            <Link href="/admin/analise/revisar" className="btn-secundario">Carregar as próximas</Link>
          )}
        </>
      )}
    </div>
  );
}
