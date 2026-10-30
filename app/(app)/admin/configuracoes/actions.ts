"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { CONFIG, getConfigIA, salvarConfig } from "@/lib/config";
import { ErroIA, PROVEDORES, verificar, type Credenciais, type Provedor, type Tarefa } from "@/lib/ia";

export type EstadoConfig = { erro?: string; ok?: string };

const campo = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const ehProvedor = (v: string): v is Provedor => v in PROVEDORES;

function revalidar() {
  revalidatePath("/admin/configuracoes");
  revalidatePath("/admin/analise");
  revalidatePath("/admin/concorrentes", "layout");
}

export async function salvarProvedor(_: EstadoConfig, formData: FormData): Promise<EstadoConfig> {
  const admin = await requireAdmin();
  const provedor = campo(formData, "provedor");
  if (!ehProvedor(provedor)) return { erro: "Provedor inválido." };

  const atual = (await getConfigIA()).credenciais;
  const novas: Credenciais = {};
  const gravar: Record<string, string> = {};

  if (provedor === "openrouter" || provedor === "gemini") {
    const apiKey = campo(formData, "api_key");
    if (!apiKey) return { erro: "Cole a chave da API." };
    novas[provedor] = { apiKey };
    gravar[provedor === "openrouter" ? CONFIG.OPENROUTER_API_KEY : CONFIG.GEMINI_API_KEY] = apiKey;
  } else {
    const accountId = campo(formData, "account_id");
    // Token em branco mantém o atual (permite corrigir só o Account ID).
    const apiToken = campo(formData, "api_token") || atual.cloudflare?.apiToken || "";
    if (!/^[0-9a-f]{32}$/i.test(accountId)) return { erro: "O Account ID da Cloudflare tem 32 caracteres (0-9 e a-f)." };
    if (!apiToken) return { erro: "Cole o API token da Cloudflare." };
    novas.cloudflare = { accountId, apiToken };
    gravar[CONFIG.CLOUDFLARE_ACCOUNT_ID] = accountId;
    gravar[CONFIG.CLOUDFLARE_API_TOKEN] = apiToken;
  }

  // Credenciais são testadas no provedor antes de serem gravadas.
  let status: string;
  try {
    status = await verificar(provedor, novas);
  } catch (e) {
    return { erro: e instanceof ErroIA ? e.message : `Não foi possível falar com ${PROVEDORES[provedor].nome}.` };
  }

  try {
    await salvarConfig(gravar, admin.user_id);
  } catch (e) {
    return { erro: "Erro ao salvar: " + (e as Error).message };
  }
  revalidar();
  return { ok: `${status} Credenciais salvas.` };
}

export async function testarProvedor(provedor: Provedor): Promise<EstadoConfig> {
  await requireAdmin();
  try {
    return { ok: await verificar(provedor, (await getConfigIA()).credenciais) };
  } catch (e) {
    return { erro: e instanceof ErroIA ? e.message : `Não foi possível falar com ${PROVEDORES[provedor].nome}.` };
  }
}

export async function removerProvedor(formData: FormData) {
  const admin = await requireAdmin();
  const provedor = campo(formData, "provedor");
  const chaves: Record<Provedor, string[]> = {
    openrouter: [CONFIG.OPENROUTER_API_KEY],
    cloudflare: [CONFIG.CLOUDFLARE_ACCOUNT_ID, CONFIG.CLOUDFLARE_API_TOKEN],
    gemini: [CONFIG.GEMINI_API_KEY],
  };
  if (!ehProvedor(provedor)) return;
  await salvarConfig(Object.fromEntries(chaves[provedor].map((k) => [k, null])), admin.user_id);
  revalidar();
}

export async function salvarUso(_: EstadoConfig, formData: FormData): Promise<EstadoConfig> {
  const admin = await requireAdmin();
  const { credenciais } = await getConfigIA();
  const gravar: Record<string, string | null> = {};

  for (const tarefa of ["pesquisa", "classificacao"] as Tarefa[]) {
    const nomeTarefa = tarefa === "pesquisa" ? "pesquisa de concorrentes" : "classificação de avaliações";
    const provedor = campo(formData, `${tarefa}_provedor`);
    const modelo = campo(formData, `${tarefa}_modelo`);

    if (!provedor) {
      gravar[CONFIG.provedor(tarefa)] = null;
      gravar[CONFIG.modelo(tarefa)] = null;
      continue;
    }
    if (!ehProvedor(provedor)) return { erro: "Provedor inválido." };
    if (!credenciais[provedor]) return { erro: `Configure ${PROVEDORES[provedor].nome} antes de usá-lo na ${nomeTarefa}.` };
    if (tarefa === "pesquisa" && !PROVEDORES[provedor].buscaWeb) {
      return { erro: `${PROVEDORES[provedor].nome} não faz busca na web; não serve para a pesquisa de concorrentes.` };
    }
    if (!/^[@\w./:-]+$/.test(modelo)) return { erro: `Escolha um modelo válido para a ${nomeTarefa}.` };
    gravar[CONFIG.provedor(tarefa)] = provedor;
    gravar[CONFIG.modelo(tarefa)] = modelo;
  }

  try {
    await salvarConfig(gravar, admin.user_id);
  } catch (e) {
    return { erro: "Erro ao salvar: " + (e as Error).message };
  }
  revalidar();
  return { ok: "Escolhas salvas." };
}
