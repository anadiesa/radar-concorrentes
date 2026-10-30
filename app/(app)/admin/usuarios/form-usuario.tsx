"use client";

import { useActionState, useEffect, useRef } from "react";
import { criarUsuario, type EstadoUsuario } from "./actions";

export function FormUsuario() {
  const [estado, acao, pendente] = useActionState<EstadoUsuario, FormData>(criarUsuario, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={acao} className="cartao space-y-4" aria-labelledby="titulo-novo-usuario">
      <h2 id="titulo-novo-usuario" className="text-lg font-semibold">Novo usuário</h2>

      {estado.erro && (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">{estado.erro}</p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-md border border-azul bg-azul-claro px-3 py-2 text-sm text-azul-escuro">{estado.ok}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className="rotulo">Nome</label>
          <input id="nome" name="nome" required className="campo" />
        </div>
        <div>
          <label htmlFor="email" className="rotulo">E-mail</label>
          <input id="email" name="email" type="email" required className="campo" />
        </div>
        <div>
          <label htmlFor="senha" className="rotulo">Senha inicial</label>
          <input id="senha" name="senha" type="text" minLength={8} required autoComplete="off" className="campo" aria-describedby="senha-ajuda" />
          <p id="senha-ajuda" className="mt-1 text-xs text-texto-suave">Mínimo de 8 caracteres.</p>
        </div>
        <div>
          <label htmlFor="papel" className="rotulo">Papel</label>
          <select id="papel" name="papel" defaultValue="vendedor" className="campo">
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn-primario" disabled={pendente}>
        {pendente ? "Criando…" : "Criar usuário"}
      </button>
    </form>
  );
}
