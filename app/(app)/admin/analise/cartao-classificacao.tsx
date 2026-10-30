"use client";

import { useActionState } from "react";
import { MAX_PALAVRAS_RESUMO } from "@/lib/analise";
import { SENTIMENTOS } from "@/lib/rotulos";
import { classificar, revisar, type EstadoClassificacao } from "./actions";

export type AvaliacaoPendente = {
  id: string;
  texto_original: string;
  nota: number | null;
  data: string | null;
  url_original: string | null;
  autor_cargo: string | null;
  concorrente: string;
  fonte: string;
  coletada_em: string;
  /** Presente quando a avaliação já foi classificada pela IA e está em revisão. */
  analise?: { sentimento: string; temas: string[]; resumo: string; modelo: string };
};

export function CartaoClassificacao({
  avaliacao: a,
  temas,
}: {
  avaliacao: AvaliacaoPendente;
  temas: { id: string; nome: string }[];
}) {
  const emRevisao = !!a.analise;
  const [estado, acao, pendente] = useActionState<EstadoClassificacao, FormData>(emRevisao ? revisar : classificar, {});
  const p = `av-${a.id}`;

  if (estado.ok) {
    return (
      <p role="status" className="cartao text-sm text-texto-suave">
        {emRevisao ? "Revisada" : "Classificada"}. ({a.concorrente} · {a.fonte})
      </p>
    );
  }

  return (
    <article className="cartao space-y-4" aria-labelledby={`${p}-titulo`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${p}-titulo`} className="font-semibold">
          {a.concorrente} <span className="font-normal text-texto-suave">· {a.fonte}</span>
        </h2>
        <p className="text-xs text-texto-suave">
          {a.data ? `Avaliação de ${a.data}` : "Sem data"}
          {a.nota !== null && ` · Nota ${a.nota.toLocaleString("pt-BR")}/5`}
          {a.autor_cargo && ` · ${a.autor_cargo}`}
          {` · Coletada em ${a.coletada_em}`}
        </p>
      </header>

      <blockquote className="whitespace-pre-line border-l-4 border-borda pl-4 text-sm">{a.texto_original}</blockquote>
      {a.url_original && (
        <a href={a.url_original} target="_blank" rel="noreferrer" className="text-xs text-azul underline">
          Ver na fonte original
        </a>
      )}

      <form action={acao} className="space-y-4">
        <input type="hidden" name="avaliacao_id" value={a.id} />
        {a.analise && (
          <p className="rounded-md bg-fundo px-3 py-2 text-xs text-texto-suave">
            Classificação sugerida pela IA ({a.analise.modelo}). Confira e corrija se precisar.
          </p>
        )}

        {estado.erro && (
          <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">{estado.erro}</p>
        )}

        <fieldset>
          <legend className="rotulo">Sentimento</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SENTIMENTOS).map(([v, r]) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-borda px-3 py-1.5 text-sm has-[:checked]:border-marinho has-[:checked]:bg-fundo has-[:checked]:font-medium"
              >
                <input type="radio" name="sentimento" value={v} required defaultChecked={a.analise?.sentimento === v} />
                {r}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="rotulo">Temas citados</legend>
          <div className="flex flex-wrap gap-2">
            {temas.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-borda px-3 py-1.5 text-sm has-[:checked]:border-azul has-[:checked]:bg-azul-claro"
              >
                <input type="checkbox" name="temas" value={t.id} defaultChecked={a.analise?.temas.includes(t.id)} />
                {t.nome}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${p}-resumo`} className="rotulo">Resumo curto{emRevisao ? "" : " (opcional)"}</label>
          <input
            id={`${p}-resumo`}
            name="resumo"
            maxLength={140}
            defaultValue={a.analise?.resumo}
            required={emRevisao}
            className="campo"
            aria-describedby={`${p}-resumo-ajuda`}
          />
          <p id={`${p}-resumo-ajuda`} className="mt-1 text-xs text-texto-suave">
            Até {MAX_PALAVRAS_RESUMO} palavras.{emRevisao ? "" : " Se ficar vazio, usamos o começo do texto."}
          </p>
        </div>

        <button type="submit" className="btn-primario" disabled={pendente}>
          {pendente ? "Salvando…" : emRevisao ? "Confirmar" : "Salvar classificação"}
        </button>
      </form>
    </article>
  );
}
