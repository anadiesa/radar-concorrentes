/**
 * Parser de CSV simples (RFC 4180): aspas, aspas escapadas (""), quebras de linha dentro de aspas,
 * CRLF e BOM. Detecta o separador pela primeira linha: `;` (padrão do Excel em pt-BR) ou `,`.
 */
export function parseCsv(texto: string): string[][] {
  const src = texto.replace(/^﻿/, "");
  const primeiraLinha = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = contar(primeiraLinha, ";") > contar(primeiraLinha, ",") ? ";" : ",";

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let emAspas = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (emAspas) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          emAspas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      emAspas = true;
    } else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

function contar(s: string, c: string) {
  return s.split(c).length - 1;
}
