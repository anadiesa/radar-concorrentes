import Link from "next/link";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Painel geral · Radar de Concorrentes" };

// Painel completo chega na etapa (d). Por enquanto, a lista de concorrentes monitorados.
export default async function PainelPage() {
  const perfil = await requirePerfil();
  const supabase = await createClient();
  const { data: concorrentes } = await supabase
    .from("concorrentes")
    .select("id, nome, segmento, site")
    .eq("ativo", true)
    .eq("e_nosso", false)
    .order("nome");

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-marinho">Olá, {perfil.nome}</h1>
      <p className="mt-1 text-sm text-texto-suave">
        O painel com indicadores, alertas e ranking de reclamações será entregue na etapa (d).
      </p>

      <section className="cartao mt-6" aria-labelledby="titulo-monitorados">
        <h2 id="titulo-monitorados" className="text-lg font-semibold">
          Concorrentes monitorados: {concorrentes?.length ?? 0}
        </h2>
        <ul className="mt-3 divide-y divide-borda">
          {concorrentes?.map((c) => (
            <li key={c.id} className="py-2 text-sm">
              <span className="font-medium">{c.nome}</span>
              {c.segmento && <span className="text-texto-suave"> · {c.segmento}</span>}
            </li>
          ))}
        </ul>
        {perfil.papel === "admin" && (
          <Link href="/admin/concorrentes" className="btn-secundario mt-4">
            Gerenciar concorrentes
          </Link>
        )}
      </section>
    </div>
  );
}
