// Teste rápido das regras de acesso (RLS), do trigger de perfil e da deduplicação.
// Requer `npx supabase start` com o seed aplicado e o .env.local preenchido.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(Boolean).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const novo = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}});
const ok = (cond, msg) => {
  console.log(cond ? "OK  " : "FALHA", msg);
  if (!cond) process.exitCode = 1;
};

const anon = novo();
const { data: a0 } = await anon.from("concorrentes").select("id");
ok((a0?.length ?? 0) === 0, "anônimo não lê concorrentes");

const vend = novo();
await vend.auth.signInWithPassword({ email: "vendedor@radar.local", password: "radar123" });
const { data: c } = await vend.from("concorrentes").select("nome");
ok(c?.length === 4, `vendedor lê concorrentes (${c?.length})`);
const { error: e1 } = await vend.from("concorrentes").insert({ nome: "X" });
ok(!!e1, "vendedor NÃO cria concorrente");
const { data: p } = await vend.from("perfis").select("papel").eq("email","vendedor@radar.local").single();
ok(p?.papel === "vendedor", "perfil do vendedor criado pelo trigger");
const { error: e2 } = await vend.from("perfis").update({ papel: "admin" }).eq("email","vendedor@radar.local").select();
const { data: p2 } = await vend.from("perfis").select("papel").eq("email","vendedor@radar.local").single();
ok(p2?.papel === "vendedor", "vendedor NÃO se promove a admin");
const { data: conc } = await vend.from("concorrentes").select("id").eq("e_nosso", false).limit(1).single();
const { data: r, error: e3 } = await vend.from("registros_campo").insert({ concorrente_id: conc.id, cliente: "Teste", situacao: "ganho", texto: "teste" }).select("id").single();
ok(!e3, "vendedor cria registro de campo " + (e3?.message ?? ""));
await vend.from("registros_campo").delete().eq("id", r?.id);

const adm = novo();
await adm.auth.signInWithPassword({ email: "admin@radar.local", password: "radar123" });
const { data: n, error: e4 } = await adm.from("concorrentes").insert({ nome: "Teste RLS" }).select("id").single();
ok(!e4, "admin cria concorrente");
const { data: f } = await adm.from("fontes").insert({ concorrente_id: n.id, tipo: "outro" }).select("id").single();
const base = { concorrente_id: n.id, fonte_id: f.id };
await adm.from("avaliacoes").insert({ ...base, texto_original: "Sistema  ÓTIMO" });
const { error: e5 } = await adm.from("avaliacoes").insert({ ...base, texto_original: "  sistema ótimo " });
ok(e5?.code === "23505", "duplicada (mesmo texto normalizado) barrada pelo hash");
await adm.from("concorrentes").delete().eq("id", n.id);
const { error: e6 } = await adm.from("concorrentes").insert({ nome: "Outro nosso", e_nosso: true });
ok(!!e6, "só existe um 'Nosso software'");

const { count } = await adm.from("avaliacoes").select("*", { count: "exact", head: true });
const { count: ca } = await adm.from("analises").select("*", { count: "exact", head: true });
ok(count === 30 && ca === 30, `seed: ${count} avaliações / ${ca} análises`);
