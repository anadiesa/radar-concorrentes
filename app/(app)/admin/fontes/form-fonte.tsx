"use client";

import { useActionState, useEffect, useRef } from "react";
import { TIPOS_FONTE } from "@/lib/rotulos";
import { criarFonte, type EstadoFonte } from "./actions";

export function FormFonte({ concorrentes }: { concorrentes: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState<EstadoFonte, FormData>(criarFonte, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={acao} className="cartao space-y-4" aria-labelledby="titulo-nova-fonte">
      <h2 id="titulo-nova-fonte" className="text-lg font-semibold">Nova fonte</h2>

      {estado.erro && (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">{estado.erro}</p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-md border border-azul bg-azul-claro px-3 py-2 text-sm text-azul-escuro">{estado.ok}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_2fr]">
        <div>
          <label htmlFor="concorrente_id" className="rotulo">Concorrente</label>
          <select id="concorrente_id" name="concorrente_id" required defaultValue="" className="campo">
            <option value="" disabled>Escolha…</option>
            {concorrentes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tipo" className="rotulo">Tipo</label>
          <select id="tipo" name="tipo" required defaultValue="" className="campo">
            <option value="" disabled>Escolha…</option>
            {Object.entries(TIPOS_FONTE).map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="url" className="rotulo">URL da página de avaliações</label>
          <input id="url" name="url" type="url" placeholder="https://" className="campo" />
        </div>
      </div>
      <button type="submit" className="btn-primario" disabled={pendente}>
        {pendente ? "Salvando…" : "Adicionar fonte"}
      </button>
    </form>
  );
}
