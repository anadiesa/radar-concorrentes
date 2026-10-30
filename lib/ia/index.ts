import "server-only";
import * as cloudflare from "./cloudflare";
import { ErroIA, PROVEDORES, type Credenciais, type Modelo, type PedidoConversa, type Provedor, type RespostaConversa } from "./comum";
import * as gemini from "./gemini";
import * as openrouter from "./openrouter";

export * from "./comum";

export type Tarefa = "pesquisa" | "classificacao";

/** O que uma tarefa precisa para rodar: provedor, modelo e as credenciais desse provedor. */
export type ConfigTarefa = { provedor: Provedor; modelo: string; credenciais: Credenciais };

function credencial<P extends Provedor>(c: Credenciais, p: P): NonNullable<Credenciais[P]> {
  const v = c[p];
  if (!v) throw new ErroIA(`${PROVEDORES[p].nome} não está configurado. Veja Administração → Configurações.`);
  return v as NonNullable<Credenciais[P]>;
}

export async function conversar(t: ConfigTarefa, pedido: Omit<PedidoConversa, "modelo">): Promise<RespostaConversa> {
  const p = { ...pedido, modelo: t.modelo };
  switch (t.provedor) {
    case "openrouter":
      return openrouter.conversar(credencial(t.credenciais, "openrouter").apiKey, p);
    case "cloudflare":
      return cloudflare.conversar(credencial(t.credenciais, "cloudflare"), p);
    case "gemini":
      return gemini.conversar(credencial(t.credenciais, "gemini").apiKey, p);
  }
}

/** Testa as credenciais de um provedor; devolve uma frase de status ou lança ErroIA. */
export async function verificar(provedor: Provedor, c: Credenciais): Promise<string> {
  switch (provedor) {
    case "openrouter":
      return openrouter.verificar(credencial(c, "openrouter").apiKey);
    case "cloudflare":
      return cloudflare.verificar(credencial(c, "cloudflare"));
    case "gemini":
      return gemini.verificar(credencial(c, "gemini").apiKey);
  }
}

export type CatalogoProvedor = { modelos: Modelo[]; sugestao: Record<Tarefa, string | null> };

/** Modelos de cada provedor configurado, com o modelo sugerido por tarefa. Falhas viram lista vazia. */
export async function catalogo(c: Credenciais): Promise<Partial<Record<Provedor, CatalogoProvedor>>> {
  const resultado: Partial<Record<Provedor, CatalogoProvedor>> = {};
  await Promise.all([
    (async () => {
      // Lista pública: aparece mesmo antes de configurar a chave.
      const m = await openrouter.listarModelos();
      resultado.openrouter = {
        modelos: m,
        sugestao: { pesquisa: openrouter.sugerirPesquisa(m), classificacao: openrouter.sugerirClassificacao(m) },
      };
    })(),
    (async () => {
      if (!c.cloudflare) return;
      const m = await cloudflare.listarModelos(c.cloudflare).catch(() => []);
      resultado.cloudflare = { modelos: m, sugestao: { pesquisa: null, classificacao: cloudflare.sugerirClassificacao(m) } };
    })(),
    (async () => {
      if (!c.gemini) return;
      const m = await gemini.listarModelos(c.gemini.apiKey).catch(() => []);
      resultado.gemini = { modelos: m, sugestao: { pesquisa: gemini.sugerir(m), classificacao: gemini.sugerir(m) } };
    })(),
  ]);
  return resultado;
}
