import { BotaoConfirmar } from "@/components/botao-confirmar";
import { requireAdmin } from "@/lib/auth";
import { getOpenRouter, mascarar } from "@/lib/config";
import { listarModelos, modeloPadrao, modeloPadraoClassificacao } from "@/lib/openrouter";
import { removerChave } from "./actions";
import { FormOpenRouter } from "./form-openrouter";

export const metadata = { title: "Configurações · Radar de Concorrentes" };

export default async function ConfiguracoesPage() {
  await requireAdmin();
  const [config, modelos] = await Promise.all([getOpenRouter(), listarModelos()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-marinho">Configurações</h1>

      <section className="cartao space-y-4" aria-labelledby="titulo-ia">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="titulo-ia" className="text-lg font-semibold">Inteligência artificial (OpenRouter)</h2>
            <p className="mt-1 text-sm text-texto-suave">
              Usada para pesquisar dados dos concorrentes na web e para classificar avaliações. Os custos saem dos créditos
              da sua conta OpenRouter, e o custo real de cada pesquisa e de cada lote aparece na tela depois de rodar.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${config ? "bg-azul-claro text-azul-escuro" : "bg-laranja-claro text-laranja"}`}
          >
            {config ? "Configurada" : "Não configurada"}
          </span>
        </div>

        <FormOpenRouter
          chaveMascarada={config ? mascarar(config.apiKey) : null}
          origem={config?.origem ?? null}
          modelo={config?.modelo ?? null}
          modeloSugerido={modeloPadrao(modelos)}
          modeloClassificacao={config?.modeloClassificacao && config.modeloClassificacao !== config.modelo ? config.modeloClassificacao : null}
          modeloClassificacaoSugerido={modeloPadraoClassificacao(modelos)}
          modelos={modelos.map(({ id, nome }) => ({ id, nome }))}
        />

        {config?.origem === "sistema" && (
          <form action={removerChave} className="border-t border-borda pt-4">
            <BotaoConfirmar className="text-sm text-laranja underline" mensagem="Remover a chave da OpenRouter? A pesquisa automática deixará de funcionar.">
              Remover chave
            </BotaoConfirmar>
          </form>
        )}
      </section>

      <p className="text-xs text-texto-suave">
        A chave fica guardada no servidor, numa tabela que nenhum usuário consegue ler — nem administradores. Ela só é usada
        pelo servidor para chamar a OpenRouter.
      </p>
    </div>
  );
}
