"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Papel } from "@/lib/auth";

type Item = { href: string; rotulo: string; etapa?: string; admin?: boolean };

// `etapa` marca telas ainda não entregues: aparecem no menu, mas desabilitadas.
const ITENS: Item[] = [
  { href: "/painel", rotulo: "Painel geral" },
  { href: "/comparativo", rotulo: "Comparativo", etapa: "e" },
  { href: "/battle-cards", rotulo: "Battle cards", etapa: "f" },
  { href: "/campo", rotulo: "Registro de campo", etapa: "g" },
];

const ITENS_ADMIN: Item[] = [
  { href: "/admin/concorrentes", rotulo: "Concorrentes", admin: true },
  { href: "/admin/fontes", rotulo: "Fontes e coletas", admin: true },
  { href: "/admin/analise", rotulo: "Classificar avaliações", admin: true },
  { href: "/admin/usuarios", rotulo: "Usuários", admin: true },
  { href: "/admin/configuracoes", rotulo: "Configurações", admin: true },
];

export function MenuLateral({
  nome,
  papel,
  pendentes = 0,
  sair,
}: {
  nome: string;
  papel: Papel;
  pendentes?: number;
  sair: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  const renderItem = (item: Item) => {
    if (item.etapa) {
      return (
        <li key={item.href}>
          <span className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-white/50" aria-disabled="true">
            {item.rotulo}
            <span className="text-xs">em breve</span>
          </span>
        </li>
      );
    }
    const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={() => setAberto(false)}
          aria-current={ativo ? "page" : undefined}
          className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${ativo ? "bg-white/15 font-medium text-white" : "text-white/85 hover:bg-white/10"}`}
        >
          {item.rotulo}
          {item.href === "/admin/analise" && pendentes > 0 && (
            <span className="rounded-full bg-laranja px-2 text-xs font-semibold text-white">
              {pendentes}
              <span className="sr-only"> pendentes</span>
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* Barra superior no celular */}
      <div className="flex items-center justify-between bg-marinho px-4 py-3 text-white md:hidden">
        <span className="font-semibold">Radar de Concorrentes</span>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="menu-principal"
          className="rounded-md border border-white/30 px-3 py-1 text-sm"
        >
          {aberto ? "Fechar" : "Menu"}
        </button>
      </div>

      <nav
        id="menu-principal"
        aria-label="Menu principal"
        className={`${aberto ? "block" : "hidden"} bg-marinho px-3 pb-4 text-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:py-5`}
      >
        <p className="hidden px-3 pb-6 text-lg font-semibold md:block">Radar de Concorrentes</p>
        <ul className="space-y-1">{ITENS.map(renderItem)}</ul>

        {papel === "admin" && (
          <>
            <p className="mt-6 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-white/60">Administração</p>
            <ul className="space-y-1">{ITENS_ADMIN.map(renderItem)}</ul>
          </>
        )}

        <div className="mt-6 border-t border-white/15 px-3 pt-4 md:mt-auto">
          <p className="text-sm font-medium">{nome}</p>
          <p className="text-xs text-white/70">{papel === "admin" ? "Administrador" : "Vendedor"}</p>
          <form action={sair}>
            <button type="submit" className="mt-3 text-sm text-white/85 underline hover:text-white">
              Sair
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
