// Teste da importação: parser de CSV, conversões e gravação com deduplicação.
// Requer `npx supabase start` com o seed aplicado e o .env.local preenchido.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { salvarAnalise } from "../lib/analise";
import { parseCsv } from "../lib/csv";
import { importarAvaliacoes, linhasDoCsv, linhasDoTexto, parseData, parseNota } from "../lib/importacao";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(Boolean).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }),
);
const ok = (cond: boolean, msg: string) => {
  console.log(cond ? "OK  " : "FALHA", msg);
  if (!cond) process.exitCode = 1;
};

// --- funções puras
const t = parseCsv('﻿texto;nota\r\n"Bom; muito ""bom""\nmesmo";4,5\r\n;\r\n');
ok(t.length === 2 && t[1][0] === 'Bom; muito "bom"\nmesmo' && t[1][1] === "4,5", "CSV com ; aspas, quebra de linha e BOM");
ok(parseCsv("texto,nota\nabc,3")[1][1] === "3", "CSV com vírgula");
ok(parseData("05/10/2026") === "2026-10-05" && parseData("2026-10-05") === "2026-10-05" && parseData("ontem") === null, "datas");
ok(parseNota("4,5") === 4.5 && parseNota("8") === 4 && parseNota("11") === null, "notas (0–10 vira 0–5)");
const csv = linhasDoCsv("Avaliação;Data;Nota;Link\nÓtimo;01/09/2026;5;https://x.com\n;;;\nRuim;xx;99;javascript:alert(1)");
ok(csv.linhas.length === 2 && csv.linhas[1].data === null && csv.linhas[1].nota === null && csv.linhas[1].url === null,
  "CSV: cabeçalho com acento, linhas inválidas tratadas, URL não-http descartada");
ok(csv.ignoradas.length === 2, `CSV: avisos de data e nota inválidas (${csv.ignoradas.length})`);
ok(linhasDoCsv("nome;nota\na;1").erro !== undefined, "CSV sem coluna texto é rejeitado");
ok(linhasDoTexto("um\n\n\n dois \n  \ntrês\ncontinua", null).length === 3, "texto colado: blocos por linha em branco");

// --- gravação
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: "admin@radar.local", password: "radar123" });
const { data: fonte } = await sb.from("fontes").select("id, concorrente_id, url").eq("tipo", "capterra").limit(1).single();
const marca = `teste-${Date.now()}`;
const linhas = linhasDoTexto(`${marca} A\n\n${marca} B\n\n${marca}   a`, "2026-10-01");
const r1 = await importarAvaliacoes(sb, fonte!, linhas);
ok(r1.novas === 2 && r1.duplicadas === 1, `1ª importação: ${r1.novas} novas / ${r1.duplicadas} duplicadas ${r1.erro ?? ""}`);
const r2 = await importarAvaliacoes(sb, fonte!, linhas);
ok(r2.novas === 0 && r2.duplicadas === 3, `reimportação: ${r2.novas} novas / ${r2.duplicadas} duplicadas`);

const { data: av } = await sb.from("avaliacoes").select("id").like("texto_original", `${marca}%`).limit(1).single();
const { data: tema } = await sb.from("temas").select("id").eq("nome", "Suporte").single();
const s1 = await salvarAnalise(sb, av!.id, { sentimento: "negativo", temas: [tema!.id], resumo_curto: "a ".repeat(30) }, "manual");
const s2 = await salvarAnalise(sb, av!.id, { sentimento: "positivo", temas: [], resumo_curto: "x" }, "manual");
const { data: an } = await sb.from("analises").select("resumo_curto, sentimento").eq("avaliacao_id", av!.id).single();
ok(!s1.erro && !!s2.erro && an?.sentimento === "negativo", "análise salva uma vez; segunda tentativa recusada");
ok(an?.resumo_curto.split(" ").length === 15, "resumo limitado a 15 palavras");

await sb.from("avaliacoes").delete().like("texto_original", `${marca}%`);
