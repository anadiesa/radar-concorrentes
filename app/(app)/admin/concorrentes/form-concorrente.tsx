"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import type { SugestaoConcorrente } from "@/lib/pesquisa-concorrente";
import { TIPOS_FONTE } from "@/lib/rotulos";
import { pesquisar, salvarConcorrente, type EstadoForm } from "./actions";

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

// Valores atuais do formulário, por nome de campo.
type Valores = Record<string, string>;

const ROTULOS_CAMPOS: Record<string, string> = {
  site: "Site",
  segmento: "Segmento",
  observacoes: "Observações",
  tempo_de_mercado: "Tempo de mercado",
  funcionarios: "Funcionários",
  vagas_abertas: "Vagas abertas",
  nota_glassdoor: "Nota Glassdoor",
  reputacao_reclame_aqui: "Reclame Aqui",
  ultimo_investimento: "Último investimento",
};

function valoresIniciais(c?: Concorrente, d?: DadosEmpresa | null): Valores {
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    nome: s(c?.nome),
    site: s(c?.site),
    segmento: s(c?.segmento),
    logo: s(c?.logo),
    observacoes: s(c?.observacoes),
    ativo: c?.ativo === false ? "" : "on",
    tempo_de_mercado: s(d?.tempo_de_mercado),
    funcionarios: s(d?.funcionarios),
    vagas_abertas: s(d?.vagas_abertas),
    nota_glassdoor: s(d?.nota_glassdoor),
    reputacao_reclame_aqui: s(d?.reputacao_reclame_aqui),
    ultimo_investimento: s(d?.ultimo_investimento),
    fonte_dados: s(d?.fonte),
  };
}

/** Converte o valor sugerido para o formato do campo (números vêm como texto livre da IA). */
function ajustar(campo: string, valor: string) {
  if (campo === "vagas_abertas") return valor.match(/\d+/)?.[0] ?? "";
  if (campo === "nota_glassdoor") return valor.replace(",", ".").match(/\d+(\.\d+)?/)?.[0] ?? "";
  return valor;
}

const dominio = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
  valor?: string;
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
  pesquisaDisponivel,
}: {
  concorrente?: Concorrente;
  dados?: DadosEmpresa | null;
  pesquisaDisponivel: boolean;
}) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(salvarConcorrente, {});
  const form = useRef<HTMLFormElement>(null);
  const [valores, setValores] = useState<Valores>(() => valoresIniciais(concorrente, dados));
  // Trocar a versão remonta os campos com os novos valores (são inputs não controlados).
  const [versao, setVersao] = useState(0);
  const [sugestao, setSugestao] = useState<SugestaoConcorrente | null>(null);
  const [preenchidos, setPreenchidos] = useState<string[]>([]);
  const [erroPesquisa, setErroPesquisa] = useState<string | null>(null);
  const [pesquisando, iniciarPesquisa] = useTransition();

  function lerFormulario(): Valores {
    const fd = new FormData(form.current!);
    const atual: Valores = {};
    for (const k of Object.keys(valores)) atual[k] = String(fd.get(k) ?? "");
    return atual;
  }

  function aoPesquisar() {
    const atual = lerFormulario();
    setErroPesquisa(null);
    iniciarPesquisa(async () => {
      const r = await pesquisar(atual.nome, atual.site || null, atual.segmento || null);
      if (r.erro || !r.sugestao) {
        setErroPesquisa(r.erro ?? "Pesquisa sem resultado.");
        return;
      }
      // Só preenche campos vazios: nunca sobrescreve o que o admin digitou.
      const novos = { ...atual };
      const alterados: string[] = [];
      for (const [campo, s] of Object.entries(r.sugestao.campos)) {
        const v = ajustar(campo, s.valor);
        if (v && !novos[campo]?.trim()) {
          novos[campo] = v;
          alterados.push(campo);
        }
      }
      // Páginas consultadas pela busca; se a busca não devolver a lista, usa as fontes de cada campo.
      const urls = r.sugestao.citacoes.length > 0
        ? r.sugestao.citacoes.map((c) => c.url)
        : Object.values(r.sugestao.campos).flatMap((c) => (c.fonte ? [c.fonte] : []));
      if (!novos.fonte_dados.trim() && urls.length > 0) {
        const doms = [...new Set(urls.map(dominio))].slice(0, 5);
        novos.fonte_dados = `Pesquisa web em ${new Date().toLocaleDateString("pt-BR")}: ${doms.join(", ")}`;
      }
      setValores(novos);
      setPreenchidos(alterados);
      setSugestao(r.sugestao);
      setVersao((n) => n + 1);
    });
  }

  return (
    <form ref={form} action={acao} className="space-y-6">
      {concorrente && <input type="hidden" name="id" value={concorrente.id} />}

      {estado.erro && (
        <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">
          {estado.erro}
        </p>
      )}

      <fieldset key={`a${versao}`} className="cartao space-y-4">
        <legend className="px-1 text-lg font-semibold">Dados do concorrente</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Campo nome="nome" rotulo="Nome *" valor={valores.nome} required />
          {pesquisaDisponivel ? (
            <button type="button" onClick={aoPesquisar} disabled={pesquisando} className="btn-secundario border-azul text-azul">
              {pesquisando ? "Pesquisando na web…" : "Pesquisar na web"}
            </button>
          ) : (
            <Link href="/admin/configuracoes" className="text-sm text-azul underline">
              Configurar pesquisa automática
            </Link>
          )}
        </div>
        {pesquisando && (
          <p role="status" className="text-sm text-texto-suave">
            Buscando site, dados da empresa e páginas de avaliação. Pode levar até 1 minuto.
          </p>
        )}
        {erroPesquisa && (
          <p role="alert" className="rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">
            {erroPesquisa}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="site" rotulo="Site" tipo="url" valor={valores.site} placeholder="https://" />
          <Campo nome="segmento" rotulo="Segmento" valor={valores.segmento} />
        </div>
        <Campo nome="logo" rotulo="URL do logo" tipo="url" valor={valores.logo} placeholder="https://" />
        <div>
          <label htmlFor="observacoes" className="rotulo">Observações</label>
          <textarea id="observacoes" name="observacoes" rows={3} defaultValue={valores.observacoes} className="campo" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={valores.ativo === "on"} className="h-4 w-4" />
          Ativo (aparece no painel e nas coletas)
        </label>
      </fieldset>

      {sugestao && (
        <section className="cartao space-y-4 border-azul" aria-labelledby="titulo-sugestao">
          <div>
            <h2 id="titulo-sugestao" className="text-lg font-semibold">Resultado da pesquisa: confira antes de salvar</h2>
            <p className="mt-1 text-sm text-texto-suave">
              {preenchidos.length > 0
                ? `Preenchemos ${preenchidos.length} campo(s) que estavam vazios. Campos que você já tinha preenchido não foram alterados.`
                : "Nenhum campo vazio pôde ser preenchido com o que foi encontrado."}{" "}
              A IA pode errar: confira os links.
            </p>
          </div>

          {Object.keys(sugestao.campos).length > 0 && (
            <ul className="divide-y divide-borda text-sm">
              {Object.entries(sugestao.campos).map(([campo, s]) => (
                <li key={campo} className="py-2">
                  <span className="font-medium">{ROTULOS_CAMPOS[campo]}:</span> {s.valor}{" "}
                  {preenchidos.includes(campo) && <span className="text-xs text-azul-escuro">(preenchido)</span>}
                  {s.obs && <span className="block text-xs text-texto-suave">{s.obs}</span>}
                  {s.fonte ? (
                    <a href={s.fonte} target="_blank" rel="noreferrer" className="block text-xs text-azul underline">
                      Fonte: {dominio(s.fonte)}
                    </a>
                  ) : (
                    <span className="block text-xs text-laranja">Sem fonte informada: confirme antes de usar.</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {sugestao.fontesAvaliacao.length > 0 && (
            <fieldset>
              <legend className="font-medium">Páginas de avaliação encontradas</legend>
              <p className="text-xs text-texto-suave">As marcadas serão cadastradas como fontes ao salvar.</p>
              <ul className="mt-2 space-y-2">
                {sugestao.fontesAvaliacao.map((f) => (
                  <li key={f.url}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="fontes_novas"
                        value={JSON.stringify({ tipo: f.tipo, url: f.url })}
                        defaultChecked={f.confirmada}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="font-medium">{TIPOS_FONTE[f.tipo]}</span>{" "}
                        <a href={f.url} target="_blank" rel="noreferrer" className="break-all text-azul underline">{f.url}</a>
                        {!f.confirmada && (
                          <span className="block text-xs text-laranja">Não apareceu nos resultados da busca: abra o link para confirmar.</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          <p className="text-xs text-texto-suave">
            Modelo: {sugestao.modelo} · {sugestao.citacoes.length} página(s) consultada(s)
          </p>
        </section>
      )}

      <fieldset key={`b${versao}`} className="cartao space-y-4">
        <legend className="px-1 text-lg font-semibold">Dados da empresa</legend>
        <p className="text-sm text-texto-suave">
          {pesquisaDisponivel ? "Preenchidos pela pesquisa ou manualmente." : "Preenchimento manual."}{" "}
          {dados?.atualizado_em && <>Última atualização: {new Date(dados.atualizado_em).toLocaleDateString("pt-BR")}.</>}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="tempo_de_mercado" rotulo="Tempo de mercado" valor={valores.tempo_de_mercado} placeholder="ex.: 8 anos" />
          <Campo nome="funcionarios" rotulo="Funcionários" valor={valores.funcionarios} placeholder="ex.: 50–100" />
          <Campo nome="vagas_abertas" rotulo="Vagas abertas" tipo="number" min={0} valor={valores.vagas_abertas} />
          <Campo nome="nota_glassdoor" rotulo="Nota Glassdoor (0 a 5)" valor={valores.nota_glassdoor} inputMode="decimal" />
          <Campo nome="reputacao_reclame_aqui" rotulo="Reputação no Reclame Aqui" valor={valores.reputacao_reclame_aqui} placeholder="ex.: Bom (7,4)" />
          <Campo nome="ultimo_investimento" rotulo="Último investimento" valor={valores.ultimo_investimento} />
        </div>
        <Campo
          nome="fonte_dados"
          rotulo="Fonte dos dados"
          valor={valores.fonte_dados}
          ajuda="De onde vieram essas informações (ex.: LinkedIn, Crunchbase, imprensa)."
        />
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primario" disabled={pendente || pesquisando}>
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        <Link href="/admin/concorrentes" className="btn-secundario">Cancelar</Link>
      </div>
    </form>
  );
}
