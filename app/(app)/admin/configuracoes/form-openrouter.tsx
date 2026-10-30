"use client";

import { useActionState, useState, useTransition } from "react";
import { salvarOpenRouter, testarConexao, type EstadoConfig } from "./actions";

function Aviso({ estado }: { estado: EstadoConfig }) {
  if (estado.erro)
    return <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">{estado.erro}</p>;
  if (estado.ok)
    return <p role="status" className="rounded-md border border-azul bg-azul-claro px-3 py-2 text-sm text-azul-escuro">{estado.ok}</p>;
  return null;
}

export function FormOpenRouter({
  chaveMascarada,
  origem,
  modelo,
  modeloSugerido,
  modelos,
}: {
  chaveMascarada: string | null;
  origem: "ambiente" | "sistema" | null;
  modelo: string | null;
  modeloSugerido: string | null;
  modelos: { id: string; nome: string }[];
}) {
  const [estado, acao, pendente] = useActionState<EstadoConfig, FormData>(salvarOpenRouter, {});
  const [teste, setTeste] = useState<EstadoConfig>({});
  const [testando, iniciarTeste] = useTransition();

  return (
    <form action={acao} className="space-y-4">
      <Aviso estado={estado} />

      <div>
        <label htmlFor="api_key" className="rotulo">Chave da API (OpenRouter)</label>
        <input
          id="api_key"
          name="api_key"
          type="password"
          autoComplete="off"
          placeholder={chaveMascarada ? `${chaveMascarada} (deixe em branco para manter)` : "sk-or-v1-…"}
          disabled={origem === "ambiente"}
          className="campo font-mono"
          aria-describedby="api_key-ajuda"
        />
        <p id="api_key-ajuda" className="mt-1 text-xs text-texto-suave">
          {origem === "ambiente"
            ? "A chave está definida na variável de ambiente OPENROUTER_API_KEY do servidor e tem prioridade sobre esta tela."
            : "Crie em openrouter.ai/settings/keys. A chave é validada antes de salvar e nunca é exibida de novo."}
        </p>
      </div>

      <div>
        <label htmlFor="modelo" className="rotulo">Modelo de IA</label>
        <input
          id="modelo"
          name="modelo"
          list="lista-modelos"
          defaultValue={modelo ?? modeloSugerido ?? ""}
          placeholder="provedor/modelo"
          className="campo font-mono"
          aria-describedby="modelo-ajuda"
        />
        <datalist id="lista-modelos">
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </datalist>
        <p id="modelo-ajuda" className="mt-1 text-xs text-texto-suave">
          Comece a digitar para ver os {modelos.length} modelos disponíveis.
          {modeloSugerido && <> Sugestão: <code>{modeloSugerido}</code> (bom em português e em seguir o formato pedido).</>}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primario" disabled={pendente}>
          {pendente ? "Validando…" : "Salvar"}
        </button>
        {chaveMascarada && (
          <button
            type="button"
            className="btn-secundario"
            disabled={testando}
            onClick={() => iniciarTeste(async () => setTeste(await testarConexao()))}
          >
            {testando ? "Testando…" : "Testar conexão"}
          </button>
        )}
      </div>
      <Aviso estado={teste} />
    </form>
  );
}
