import { requireAdmin } from "@/lib/auth";
import { getTarefa } from "@/lib/config";
import { FormConcorrente } from "../form-concorrente";

export const metadata = { title: "Novo concorrente · Radar de Concorrentes" };

export default async function NovoConcorrentePage() {
  await requireAdmin();
  const pesquisa = await getTarefa("pesquisa");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-marinho">Novo concorrente</h1>
      <FormConcorrente pesquisaDisponivel={!!pesquisa} />
    </div>
  );
}
