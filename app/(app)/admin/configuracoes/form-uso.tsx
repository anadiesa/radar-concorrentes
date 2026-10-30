"use client";

import { useActionState, useState } from "react";
import type { Provedor } from "@/lib/ia/comum";
import { salvarUso, type EstadoConfig } from "./actions";
import { Aviso } from "./cartao-provedor";

type Tarefa = "pesquisa" | "classificacao";

export type OpcaoProvedor = {
  id: Provedor;
  nome: string;
  configurado: boolean;
  buscaWeb: boolean;
  modelos: { id: string; nome: string }[];
  sugestao: Record<Tarefa, string | null>;
};

const TAREFAS: { id: Tarefa; titulo: string; ajuda: string }[] = [
  {
    id: "pesquisa",
    titulo: "Pesquisa de concorrentes",
    ajuda: "Precisa de busca na web: só OpenRouter ou Gemini. Um modelo maior acerta mais os dados.",
  },
  {
    id: "classificacao",
    titulo: "Classificação de avaliações",
    ajuda: "Tarefa simples e de volume: um modelo pequeno e barato (ou da cota grátis) basta.",
  },
];

function BlocoTarefa({
  tarefa,
  opcoes,
  provedorInicial,
  modeloInicial,
}: {
  tarefa: (typeof TAREFAS)[number];
  opcoes: OpcaoProvedor[];
  provedorInicial: Provedor | null;
  modeloInicial: string | null;
}) {
  const disponiveis = opcoes.filter((o) => o.configurado && (tarefa.id !== "pesquisa" || o.buscaWeb));
  const [provedor, setProvedor] = useState<string>(provedorInicial ?? "");
  const [modelo, setModelo] = useState<string>(modeloInicial ?? "");
  const atual = opcoes.find((o) => o.id === provedor);
  const sugestao = atual?.sugestao[tarefa.id] ?? null;
  const p = `uso-${tarefa.id}`;

  function trocarProvedor(novo: string) {
    setProvedor(novo);
    // Modelos não servem de um provedor para outro: começa pela sugestão do novo provedor.
    setModelo(opcoes.find((o) => o.id === novo)?.sugestao[tarefa.id] ?? "");
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-borda p-4">
      <legend className="px-1 font-semibold">{tarefa.titulo}</legend>
      <p className="text-xs text-texto-suave">{tarefa.ajuda}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div>
          <label htmlFor={`${p}-provedor`} className="rotulo">Provedor</label>
          <select
            id={`${p}-provedor`}
            name={`${tarefa.id}_provedor`}
            value={provedor}
            onChange={(e) => trocarProvedor(e.target.value)}
            className="campo"
          >
            <option value="">Desativada</option>
            {opcoes
              .filter((o) => tarefa.id !== "pesquisa" || o.buscaWeb)
              .map((o) => (
                <option key={o.id} value={o.id} disabled={!o.configurado}>
                  {o.nome}
                  {o.configurado ? "" : " (configure acima)"}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${p}-modelo`} className="rotulo">Modelo</label>
          <input
            id={`${p}-modelo`}
            name={`${tarefa.id}_modelo`}
            list={`${p}-lista`}
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            disabled={!provedor}
            required={!!provedor}
            placeholder={provedor ? "Comece a digitar para ver a lista" : "Escolha o provedor"}
            className="campo font-mono"
            aria-describedby={`${p}-modelo-ajuda`}
          />
          <datalist id={`${p}-lista`}>
            {atual?.modelos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </datalist>
          <p id={`${p}-modelo-ajuda`} className="mt-1 text-xs text-texto-suave">
            {atual ? `${atual.modelos.length} modelos disponíveis.` : ""}
            {sugestao && (
              <>
                {" "}Sugestão: <code>{sugestao}</code>
                {modelo !== sugestao && (
                  <button type="button" onClick={() => setModelo(sugestao)} className="ml-1 text-azul underline">usar</button>
                )}
              </>
            )}
          </p>
        </div>
      </div>
      {disponiveis.length === 0 && (
        <p className="text-xs text-laranja">Nenhum provedor compatível configurado ainda.</p>
      )}
    </fieldset>
  );
}

export function FormUso({
  opcoes,
  atual,
}: {
  opcoes: OpcaoProvedor[];
  atual: Record<Tarefa, { provedor: Provedor | null; modelo: string | null }>;
}) {
  const [estado, acao, pendente] = useActionState<EstadoConfig, FormData>(salvarUso, {});

  return (
    <form action={acao} className="space-y-4">
      <Aviso estado={estado} />
      {TAREFAS.map((t) => (
        <BlocoTarefa
          key={t.id}
          tarefa={t}
          opcoes={opcoes}
          provedorInicial={atual[t.id].provedor}
          modeloInicial={atual[t.id].modelo}
        />
      ))}
      <button type="submit" className="btn-primario" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar escolhas"}
      </button>
    </form>
  );
}
