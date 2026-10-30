import { notFound } from "next/navigation";
import { BotaoConfirmar } from "@/components/botao-confirmar";
import { requireAdmin } from "@/lib/auth";
import { getOpenRouter } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { excluirConcorrente } from "../actions";
import { FormConcorrente } from "../form-concorrente";

export const metadata = { title: "Editar concorrente · Radar de Concorrentes" };

export default async function EditarConcorrentePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: concorrente }, { data: dados }, config] = await Promise.all([
    supabase.from("concorrentes").select("id, nome, site, segmento, logo, observacoes, ativo, e_nosso").eq("id", id).maybeSingle(),
    supabase.from("dados_empresa").select("*").eq("concorrente_id", id).maybeSingle(),
    getOpenRouter(),
  ]);
  if (!concorrente) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-marinho">Editar {concorrente.nome}</h1>
      <FormConcorrente concorrente={concorrente} dados={dados} pesquisaDisponivel={!!config?.modelo} />

      {!concorrente.e_nosso && (
        <section className="cartao mt-8 border-laranja" aria-labelledby="titulo-excluir">
          <h2 id="titulo-excluir" className="font-semibold text-laranja">Excluir concorrente</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Remove também fontes, avaliações, análises, registros de campo e battle card deste concorrente. Para apenas
            parar de monitorar, desmarque “Ativo”.
          </p>
          <form action={excluirConcorrente} className="mt-3">
            <input type="hidden" name="id" value={concorrente.id} />
            <BotaoConfirmar className="btn-perigo" mensagem={`Excluir ${concorrente.nome} e todos os dados ligados a ele?`}>
              Excluir definitivamente
            </BotaoConfirmar>
          </form>
        </section>
      )}
    </div>
  );
}
