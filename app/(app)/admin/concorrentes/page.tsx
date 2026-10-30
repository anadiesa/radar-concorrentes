import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Concorrentes · Radar de Concorrentes" };

export default async function ConcorrentesPage({
  searchParams,
}: {
  searchParams: Promise<{ salvo?: string }>;
}) {
  await requireAdmin();
  const { salvo } = await searchParams;
  const supabase = await createClient();
  const { data: concorrentes, error } = await supabase
    .from("concorrentes")
    .select("id, nome, site, segmento, ativo, e_nosso, fontes(count), avaliacoes(count)")
    .order("e_nosso", { ascending: false })
    .order("nome");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-marinho">Concorrentes</h1>
        <Link href="/admin/concorrentes/novo" className="btn-primario">Novo concorrente</Link>
      </div>

      {salvo && (
        <p role="status" className="mt-4 rounded-md border border-azul bg-azul-claro px-3 py-2 text-sm text-azul-escuro">
          Alterações salvas.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-laranja">Erro ao carregar: {error.message}</p>
      )}

      <div className="cartao mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Concorrentes cadastrados</caption>
          <thead className="border-b border-borda bg-fundo text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Nome</th>
              <th scope="col" className="px-4 py-3 font-medium">Segmento</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Fontes</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Avaliações</th>
              <th scope="col" className="px-4 py-3 font-medium">Situação</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {concorrentes?.map((c) => (
              <tr key={c.id}>
                <th scope="row" className="px-4 py-3 font-medium">
                  {c.nome}
                  {c.e_nosso && (
                    <span className="ml-2 rounded bg-azul-claro px-2 py-0.5 text-xs font-medium text-azul-escuro">nosso</span>
                  )}
                  {c.site && (
                    <a href={c.site} target="_blank" rel="noreferrer" className="block text-xs font-normal text-azul underline">
                      {c.site.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </th>
                <td className="px-4 py-3">{c.segmento ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.fontes[0]?.count ?? 0}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.avaliacoes[0]?.count ?? 0}</td>
                <td className="px-4 py-3">{c.ativo ? "Ativo" : "Inativo"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/concorrentes/${c.id}`} className="text-azul underline">
                    Editar<span className="sr-only"> {c.nome}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
