"use client";

import Link from "next/link";
import { useActionState } from "react";
import { salvarConcorrente, type EstadoForm } from "./actions";

type Concorrente = {
  id: string;
  nome: string;
  site: string | null;
  segmento: string | null;
  logo: string | null;
  observacoes: string | null;
  ativo: boolean;
  e_nosso: boolean;
};

type DadosEmpresa = {
  tempo_de_mercado: string | null;
  funcionarios: string | null;
  vagas_abertas: number | null;
  nota_glassdoor: number | null;
  reputacao_reclame_aqui: string | null;
  ultimo_investimento: string | null;
  fonte: string | null;
  atualizado_em: string;
};

function Campo({
  nome,
  rotulo,
  valor,
  tipo = "text",
  ajuda,
  ...resto
}: {
  nome: string;
  rotulo: string;
  valor?: string | number | null;
  tipo?: string;
  ajuda?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={nome} className="rotulo">{rotulo}</label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        defaultValue={valor ?? ""}
        aria-describedby={ajuda ? `${nome}-ajuda` : undefined}
        className="campo"
        {...resto}
      />
      {ajuda && <p id={`${nome}-ajuda`} className="mt-1 text-xs text-texto-suave">{ajuda}</p>}
    </div>
  );
}

export function FormConcorrente({
  concorrente,
  dados,
}: {
  concorrente?: Concorrente;
  dados?: DadosEmpresa | null;
}) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(salvarConcorrente, {});

  return (
    <form action={acao} className="space-y-6">
      {concorrente && <input type="hidden" name="id" value={concorrente.id} />}

      {estado.erro && (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">
          {estado.erro}
        </p>
      )}

      <fieldset className="cartao space-y-4">
        <legend className="px-1 text-lg font-semibold">Dados do concorrente</legend>
        <Campo nome="nome" rotulo="Nome *" valor={concorrente?.nome} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="site" rotulo="Site" tipo="url" valor={concorrente?.site} placeholder="https://" />
          <Campo nome="segmento" rotulo="Segmento" valor={concorrente?.segmento} />
        </div>
        <Campo nome="logo" rotulo="URL do logo" tipo="url" valor={concorrente?.logo} placeholder="https://" />
        <div>
          <label htmlFor="observacoes" className="rotulo">Observações</label>
          <textarea id="observacoes" name="observacoes" rows={3} defaultValue={concorrente?.observacoes ?? ""} className="campo" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={concorrente?.ativo ?? true} className="h-4 w-4" />
          Ativo (aparece no painel e nas coletas)
        </label>
      </fieldset>

      <fieldset className="cartao space-y-4">
        <legend className="px-1 text-lg font-semibold">Dados da empresa</legend>
        <p className="text-sm text-texto-suave">
          Preenchimento manual.{" "}
          {dados?.atualizado_em && <>Última atualização: {new Date(dados.atualizado_em).toLocaleDateString("pt-BR")}.</>}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="tempo_de_mercado" rotulo="Tempo de mercado" valor={dados?.tempo_de_mercado} placeholder="ex.: 8 anos" />
          <Campo nome="funcionarios" rotulo="Funcionários" valor={dados?.funcionarios} placeholder="ex.: 50–100" />
          <Campo nome="vagas_abertas" rotulo="Vagas abertas" tipo="number" min={0} valor={dados?.vagas_abertas} />
          <Campo nome="nota_glassdoor" rotulo="Nota Glassdoor (0 a 5)" valor={dados?.nota_glassdoor} inputMode="decimal" />
          <Campo nome="reputacao_reclame_aqui" rotulo="Reputação no Reclame Aqui" valor={dados?.reputacao_reclame_aqui} placeholder="ex.: Bom (7,4)" />
          <Campo nome="ultimo_investimento" rotulo="Último investimento" valor={dados?.ultimo_investimento} />
        </div>
        <Campo
          nome="fonte_dados"
          rotulo="Fonte dos dados"
          valor={dados?.fonte}
          ajuda="De onde vieram essas informações (ex.: LinkedIn, Crunchbase, imprensa)."
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primario" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <Link href="/admin/concorrentes" className="btn-secundario">Cancelar</Link>
      </div>
    </form>
  );
}
