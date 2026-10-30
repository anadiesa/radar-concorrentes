import { requireAdmin } from "@/lib/auth";
import { getConfigIA, mascarar } from "@/lib/config";
import { catalogo, PROVEDORES, type Provedor } from "@/lib/ia";
import { CartaoProvedor } from "./cartao-provedor";
import { FormUso, type OpcaoProvedor } from "./form-uso";

export const metadata = { title: "Configurações · Radar de Concorrentes" };

const ORDEM: Provedor[] = ["openrouter", "cloudflare", "gemini"];

export default async function ConfiguracoesPage() {
  await requireAdmin();
  const config = await getConfigIA();
  const cat = await catalogo(config.credenciais);
  const { credenciais: c } = config;

  const mascaraDe = (p: Provedor) =>
    p === "cloudflare" ? (c.cloudflare ? mascarar(c.cloudflare.apiToken) : null) : c[p] ? mascarar(c[p]!.apiKey) : null;

  const opcoes: OpcaoProvedor[] = ORDEM.map((p) => ({
    id: p,
    nome: PROVEDORES[p].nome,
    configurado: !!c[p],
    buscaWeb: PROVEDORES[p].buscaWeb,
    modelos: (cat[p]?.modelos ?? []).map(({ id, nome }) => ({ id, nome })),
    sugestao: cat[p]?.sugestao ?? { pesquisa: null, classificacao: null },
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-marinho">Configurações</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Configure um ou mais provedores de IA e escolha qual usar em cada tarefa. O custo real aparece na tela depois de
          cada pesquisa ou lote de classificação (para provedores que informam custo).
        </p>
      </div>

      <section className="space-y-4" aria-labelledby="titulo-uso">
        <h2 id="titulo-uso" className="text-lg font-semibold">Qual IA usar em cada tarefa</h2>
        <div className="cartao">
          <FormUso opcoes={opcoes} atual={config.tarefas} />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="titulo-provedores">
        <h2 id="titulo-provedores" className="text-lg font-semibold">Provedores de IA</h2>
        {ORDEM.map((p) => (
          <CartaoProvedor
            key={p}
            provedor={p}
            nome={PROVEDORES[p].nome}
            descricao={PROVEDORES[p].descricao}
            configurado={!!c[p]}
            origem={config.origem[p] ?? null}
            mascara={mascaraDe(p)}
            accountId={c.cloudflare?.accountId ?? null}
          />
        ))}
      </section>

      <p className="text-xs text-texto-suave">
        Chaves e tokens ficam guardados no servidor, numa tabela que nenhum usuário consegue ler — nem administradores.
        Só o servidor os usa para chamar os provedores.
      </p>
    </div>
  );
}
