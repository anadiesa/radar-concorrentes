// Rótulos em português para os enums do banco.

export const TIPOS_FONTE = {
  b2bstack: "B2B Stack",
  g2: "G2",
  capterra: "Capterra",
  reclame_aqui: "Reclame Aqui",
  google_play: "Google Play",
  app_store: "App Store",
  outro: "Outro",
} as const;

export type TipoFonte = keyof typeof TIPOS_FONTE;

export const STATUS_COLETA = {
  nunca: "Nunca coletada",
  executando: "Em andamento",
  sucesso: "Sucesso",
  erro: "Erro",
} as const;

export const SENTIMENTOS = {
  positivo: "Positivo",
  negativo: "Negativo",
  neutro: "Neutro",
} as const;

export type Sentimento = keyof typeof SENTIMENTOS;

export function formatarData(iso: string | null | undefined) {
  if (!iso) return "—";
  // Datas puras (AAAA-MM-DD) não devem sofrer ajuste de fuso.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
  return d.toLocaleDateString("pt-BR");
}
