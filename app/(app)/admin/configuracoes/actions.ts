"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { CONFIG, getOpenRouter, salvarConfig } from "@/lib/config";
import { ErroOpenRouter, verificarChave } from "@/lib/openrouter";

export type EstadoConfig = { erro?: string; ok?: string };

export async function salvarOpenRouter(_: EstadoConfig, formData: FormData): Promise<EstadoConfig> {
  const admin = await requireAdmin();
  const novaChave = String(formData.get("api_key") ?? "").trim();
  const modelo = String(formData.get("modelo") ?? "").trim();
  const modeloClassificacao = String(formData.get("modelo_classificacao") ?? "").trim();

  for (const m of [modelo, modeloClassificacao]) {
    if (m && !/^[\w.-]+\/[\w.:-]+$/.test(m)) {
      return { erro: `Modelo "${m}" inválido. Use o formato "provedor/modelo", ex.: anthropic/claude-sonnet-…` };
    }
  }

  // Chave nova é validada na OpenRouter antes de ser gravada.
  if (novaChave) {
    try {
      await verificarChave(novaChave);
    } catch (e) {
      return { erro: e instanceof ErroOpenRouter ? e.message : "Não foi possível falar com a OpenRouter." };
    }
  }

  try {
    await salvarConfig(
      {
        ...(novaChave ? { [CONFIG.CHAVE_API]: novaChave } : {}),
        [CONFIG.CHAVE_MODELO]: modelo || null,
        [CONFIG.CHAVE_MODELO_CLASSIFICACAO]: modeloClassificacao || null,
      },
      admin.user_id,
    );
  } catch (e) {
    return { erro: "Erro ao salvar: " + (e as Error).message };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: novaChave ? "Chave validada e salva." : "Configurações salvas." };
}

export async function testarConexao(): Promise<EstadoConfig> {
  await requireAdmin();
  const config = await getOpenRouter();
  if (!config) return { erro: "Nenhuma chave configurada." };
  try {
    const info = await verificarChave(config.apiKey);
    const saldo =
      info.limiteRestante === null ? "sem limite definido na chave" : `US$ ${info.limiteRestante.toFixed(2)} restantes no limite da chave`;
    return { ok: `Conexão OK. Uso total: US$ ${info.usoTotal.toFixed(2)} · ${saldo}.` };
  } catch (e) {
    return { erro: e instanceof ErroOpenRouter ? e.message : "Não foi possível falar com a OpenRouter." };
  }
}

export async function removerChave() {
  const admin = await requireAdmin();
  await salvarConfig({ [CONFIG.CHAVE_API]: null }, admin.user_id);
  revalidatePath("/admin/configuracoes");
}
