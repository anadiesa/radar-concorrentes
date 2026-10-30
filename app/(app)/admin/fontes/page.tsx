import Link from "next/link";
import { BotaoConfirmar } from "@/components/botao-confirmar";
import { requireAdmin } from "@/lib/auth";
import { formatarData, STATUS_COLETA, TIPOS_FONTE } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";
import { excluirFonte } from "./actions";
import { FormFonte } from "./form-fonte";

export const metadata = { title: "Fontes e coletas · Radar de Concorrentes" };

export default async function FontesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: concorrentes } = await supabase
    .from("concorrentes")
    .select("id, nome, e_nosso, fontes(id, tipo, url, modo, ultima_coleta, status_ultima_coleta, avaliacoes(count))")
    .order("e_nosso", { ascending: false })
    .order("nome");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-marinho">Fontes e coletas</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Onde buscamos as avaliações de cada concorrente. Por enquanto a entrada é manual: importe um CSV ou cole
          as avaliações. A coleta automática chega na etapa (h), apenas para fontes cujos termos permitem.
        </p>
      </div>

      <FormFonte concorrentes={concorrentes?.map(({ id, nome }) => ({ id, nome })) ?? []} />

      {concorrentes?.map((c) => (
        <section key={c.id} className="cartao overflow-x-auto p-0" aria-labelledby={`fontes-${c.id}`}>
          <h2 id={`fontes-${c.id}`} className="border-b border-borda px-4 py-3 font-semibold">
            {c.nome}
          </h2>
          {c.fontes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-texto-suave">Nenhuma fonte cadastrada.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Fontes de {c.nome}</caption>
              <thead className="bg-fundo text-texto-suave">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Fonte</th>
                  <th scope="col" className="px-4 py-2 font-medium">Modo</th>
                  <th scope="col" className="px-4 py-2 font-medium">Última coleta</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Avaliações</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {c.fontes.map((f) => (
                  <tr key={f.id}>
                    <th scope="row" className="px-4 py-2 font-medium">
                      {TIPOS_FONTE[f.tipo as keyof typeof TIPOS_FONTE]}
                      {f.url && (
                        <a href={f.url} target="_blank" rel="noreferrer" className="block max-w-xs truncate text-xs font-normal text-azul underline">
                          {f.url.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </th>
                    <td className="px-4 py-2">{f.modo === "manual" ? "Manual" : "Automático"}</td>
                    <td className="px-4 py-2">
                      {formatarData(f.ultima_coleta)}
                      <span className={`block text-xs ${f.status_ultima_coleta === "erro" ? "text-laranja" : "text-texto-suave"}`}>
                        {STATUS_COLETA[f.status_ultima_coleta as keyof typeof STATUS_COLETA]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{f.avaliacoes[0]?.count ?? 0}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-4">
                        <Link href={`/admin/fontes/${f.id}/importar`} className="text-azul underline">
                          Importar<span className="sr-only"> avaliações</span>
                        </Link>
                        <form action={excluirFonte}>
                          <input type="hidden" name="id" value={f.id} />
                          <BotaoConfirmar
                            className="text-laranja underline"
                            mensagem="Excluir esta fonte e todas as avaliações importadas dela?"
                          >
                            Excluir<span className="sr-only"> fonte</span>
                          </BotaoConfirmar>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
