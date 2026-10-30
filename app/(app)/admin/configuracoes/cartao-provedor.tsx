"use client";

import { useActionState, useState, useTransition } from "react";
import { BotaoConfirmar } from "@/components/botao-confirmar";
import type { Provedor } from "@/lib/ia/comum";
import { removerProvedor, salvarProvedor, testarProvedor, type EstadoConfig } from "./actions";

export function Aviso({ estado }: { estado: EstadoConfig }) {
  if (estado.erro)
    return <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">{estado.erro}</p>;
  if (estado.ok)
    return <p role="status" className="rounded-md border border-azul bg-azul-claro px-3 py-2 text-sm text-azul-escuro">{estado.ok}</p>;
  return null;
}

const AJUDA: Record<Provedor, React.ReactNode> = {
  openrouter: (
    <>
      Crie em <a className="text-azul underline" href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">openrouter.ai/settings/keys</a>{" "}
      e adicione créditos em <em>Credits</em>.
    </>
  ),
  cloudflare: (
    <>
      No painel da Cloudflare: <em>Workers AI → Use REST API</em>. Copie o <strong>Account ID</strong> e clique em{" "}
      <strong>Create a Workers AI API Token</strong>.
    </>
  ),
  gemini: (
    <>
      Crie em <a className="text-azul underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>{" "}
      (botão <em>Create API key</em>).
    </>
  ),
};

export function CartaoProvedor({
  provedor,
  nome,
  descricao,
  configurado,
  origem,
  mascara,
  accountId,
}: {
  provedor: Provedor;
  nome: string;
  descricao: string;
  configurado: boolean;
  origem: "ambiente" | "sistema" | null;
  mascara: string | null;
  accountId: string | null;
}) {
  const [estado, acao, pendente] = useActionState<EstadoConfig, FormData>(salvarProvedor, {});
  const [teste, setTeste] = useState<EstadoConfig>({});
  const [testando, iniciarTeste] = useTransition();
  const p = `prov-${provedor}`;
  const doAmbiente = origem === "ambiente";

  return (
    <section className="cartao space-y-4" aria-labelledby={`${p}-titulo`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`${p}-titulo`} className="font-semibold">{nome}</h3>
          <p className="mt-1 text-sm text-texto-suave">{descricao}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${configurado ? "bg-azul-claro text-azul-escuro" : "bg-fundo text-texto-suave"}`}>
          {configurado ? "Configurado" : "Não configurado"}
        </span>
      </div>

      {doAmbiente ? (
        <p className="text-sm text-texto-suave">Definido por variável de ambiente no servidor (tem prioridade sobre esta tela).</p>
      ) : (
        <form action={acao} className="space-y-3">
          <input type="hidden" name="provedor" value={provedor} />
          <Aviso estado={estado} />
          {provedor === "cloudflare" && (
            <div>
              <label htmlFor={`${p}-account`} className="rotulo">Account ID</label>
              <input id={`${p}-account`} name="account_id" defaultValue={accountId ?? ""} autoComplete="off" className="campo font-mono" required />
            </div>
          )}
          <div>
            <label htmlFor={`${p}-chave`} className="rotulo">{provedor === "cloudflare" ? "API token" : "Chave da API"}</label>
            <input
              id={`${p}-chave`}
              name={provedor === "cloudflare" ? "api_token" : "api_key"}
              type="password"
              autoComplete="off"
              placeholder={mascara ? `${mascara} (deixe em branco para manter)` : ""}
              required={!mascara || provedor !== "cloudflare"}
              className="campo font-mono"
              aria-describedby={`${p}-ajuda`}
            />
            <p id={`${p}-ajuda`} className="mt-1 text-xs text-texto-suave">{AJUDA[provedor]}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primario" disabled={pendente}>
              {pendente ? "Validando…" : configurado ? "Trocar credenciais" : "Salvar"}
            </button>
            {configurado && (
              <button
                type="button"
                className="btn-secundario"
                disabled={testando}
                onClick={() => iniciarTeste(async () => setTeste(await testarProvedor(provedor)))}
              >
                {testando ? "Testando…" : "Testar conexão"}
              </button>
            )}
          </div>
        </form>
      )}
      <Aviso estado={teste} />

      {configurado && !doAmbiente && (
        <form action={removerProvedor} className="border-t border-borda pt-3">
          <input type="hidden" name="provedor" value={provedor} />
          <BotaoConfirmar className="text-sm text-laranja underline" mensagem={`Remover as credenciais de ${nome}?`}>
            Remover credenciais
          </BotaoConfirmar>
        </form>
      )}
    </section>
  );
}
