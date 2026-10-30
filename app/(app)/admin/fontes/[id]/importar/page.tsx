import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatarData, TIPOS_FONTE } from "@/lib/rotulos";
import { createClient } from "@/lib/supabase/server";
import { FormImportacao } from "./form-importacao";

export const metadata = { title: "Importar avaliações · Radar de Concorrentes" };

export default async function ImportarPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: fonte }, { data: coletas }] = await Promise.all([
    supabase.from("fontes").select("id, tipo, url, concorrentes(nome)").eq("id", id).maybeSingle(),
    supabase.from("coletas").select("id, iniciada_em, status, novas, duplicadas").eq("fonte_id", id).order("iniciada_em", { ascending: false }).limit(5),
  ]);
  if (!fonte) notFound();

  const concorrente = fonte.concorrentes as unknown as { nome: string } | null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/fontes" className="text-sm text-azul underline">← Fontes e coletas</Link>
        <h1 className="mt-2 text-2xl font-semibold text-marinho">
          Importar avaliações: {concorrente?.nome} · {TIPOS_FONTE[fonte.tipo as keyof typeof TIPOS_FONTE]}
        </h1>
        <p className="mt-1 text-sm text-texto-suave">
          Avaliações repetidas (mesmo texto nesta fonte) são ignoradas automaticamente.
        </p>
      </div>

      <FormImportacao fonteId={fonte.id} />

      {coletas && coletas.length > 0 && (
        <section className="cartao" aria-labelledby="titulo-historico">
          <h2 id="titulo-historico" className="font-semibold">Últimas importações</h2>
          <ul className="mt-2 divide-y divide-borda text-sm">
            {coletas.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span>{formatarData(c.iniciada_em)} às {new Date(c.iniciada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className={c.status === "erro" ? "text-laranja" : "text-texto-suave"}>
                  {c.status === "erro" ? "Erro" : `${c.novas} novas · ${c.duplicadas} repetidas`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
