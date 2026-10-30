"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importar, type EstadoImportacao } from "../../actions";

export function FormImportacao({ fonteId }: { fonteId: string }) {
  const [modo, setModo] = useState<"texto" | "csv">("texto");
  const [estado, acao, pendente] = useActionState<EstadoImportacao, FormData>(importar, {});

  return (
    <div className="space-y-4">
      {estado.erro && (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">{estado.erro}</p>
      )}
      {estado.novas !== undefined && (
        <div role="status" className="rounded-md border border-azul bg-azul-claro px-4 py-3 text-sm text-azul-escuro">
          <p>
            <strong>{estado.novas}</strong> avaliações novas importadas
            {estado.duplicadas ? <>; <strong>{estado.duplicadas}</strong> já existiam e foram ignoradas</> : null}.
          </p>
          {estado.novas > 0 && (
            <Link href="/admin/analise" className="mt-2 inline-block font-medium underline">
              Classificar as avaliações importadas
            </Link>
          )}
        </div>
      )}
      {estado.avisos && estado.avisos.length > 0 && (
        <details className="rounded-md border border-borda bg-white px-4 py-3 text-sm">
          <summary className="cursor-pointer">{estado.avisos.length} aviso(s) sobre linhas do arquivo</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-texto-suave">
            {estado.avisos.slice(0, 50).map((a) => <li key={a}>{a}</li>)}
          </ul>
        </details>
      )}

      <div role="tablist" aria-label="Forma de importação" className="flex gap-2">
        {(["texto", "csv"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => setModo(m)}
            className={modo === m ? "btn-primario" : "btn-secundario"}
          >
            {m === "texto" ? "Colar texto" : "Arquivo CSV"}
          </button>
        ))}
      </div>

      <form action={acao} className="cartao space-y-4">
        <input type="hidden" name="fonte_id" value={fonteId} />
        <input type="hidden" name="modo" value={modo} />

        {modo === "texto" ? (
          <>
            <div>
              <label htmlFor="texto" className="rotulo">Avaliações</label>
              <textarea id="texto" name="texto" rows={12} required className="campo font-mono" aria-describedby="texto-ajuda" />
              <p id="texto-ajuda" className="mt-1 text-xs text-texto-suave">
                Cole uma avaliação por bloco, deixando <strong>uma linha em branco</strong> entre elas. Não inclua nome,
                e-mail ou telefone dos autores.
              </p>
            </div>
            <div className="max-w-xs">
              <label htmlFor="data" className="rotulo">Data das avaliações (opcional)</label>
              <input id="data" name="data" type="date" className="campo" />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="arquivo" className="rotulo">Arquivo CSV</label>
            <input id="arquivo" name="arquivo" type="file" accept=".csv,text/csv" required className="campo" aria-describedby="csv-ajuda" />
            <div id="csv-ajuda" className="mt-2 text-xs text-texto-suave">
              <p>
                Separado por <code>;</code> ou <code>,</code>, com cabeçalho na primeira linha. Só <code>texto</code> é
                obrigatória; as demais colunas são opcionais:
              </p>
              <pre className="mt-1 overflow-x-auto rounded bg-fundo p-2">texto;data;nota;url;cargo{"\n"}&quot;Suporte demorou 3 dias&quot;;15/10/2026;2;https://...;Gerente</pre>
              <p className="mt-1">Data em DD/MM/AAAA ou AAAA-MM-DD. Nota de 0 a 5 estrelas; notas acima de 5 são tratadas como escala 0 a 10 e convertidas.</p>
            </div>
          </div>
        )}

        <button type="submit" className="btn-primario" disabled={pendente}>
          {pendente ? "Importando…" : "Importar"}
        </button>
      </form>
    </div>
  );
}
