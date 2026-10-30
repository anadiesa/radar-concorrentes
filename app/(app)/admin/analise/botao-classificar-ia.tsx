"use client";

import { useState, useTransition } from "react";
import type { ResultadoClassificacao } from "@/lib/classificacao-ia";
import { classificarComIa } from "./actions";

export function BotaoClassificarIa({ pendentes }: { pendentes: number }) {
  const [resultado, setResultado] = useState<ResultadoClassificacao | null>(null);
  const [rodando, iniciar] = useTransition();
  const lote = Math.min(pendentes, 200);

  return (
    <div className="cartao space-y-3 border-azul">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          A IA pode classificar {pendentes > 200 ? `as próximas ${lote} de ${pendentes}` : `as ${lote}`} avaliações pendentes.
          Depois você revisa.
        </p>
        <button
          type="button"
          className="btn-primario"
          disabled={rodando || pendentes === 0}
          onClick={() => iniciar(async () => setResultado(await classificarComIa()))}
        >
          {rodando ? "Classificando…" : "Classificar pendentes com IA"}
        </button>
      </div>
      {rodando && (
        <p role="status" className="text-sm text-texto-suave">
          Classificando em lotes de 10. Leva cerca de {Math.max(10, Math.ceil(lote / 30) * 10)} segundos; não feche a página.
        </p>
      )}
      {resultado && !rodando && (
        <p role={resultado.erro ? "alert" : "status"} className={`text-sm ${resultado.erro ? "text-laranja" : "text-azul-escuro"}`}>
          {resultado.classificadas} classificada(s)
          {resultado.falhas > 0 && `, ${resultado.falhas} com falha (continuam na fila)`}
          {resultado.custoUsd > 0 && ` · custo: US$ ${resultado.custoUsd.toFixed(4)}`}.
          {resultado.erro && ` ${resultado.erro}`}
        </p>
      )}
    </div>
  );
}
