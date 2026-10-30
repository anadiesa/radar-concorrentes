import { sair } from "@/app/(auth)/login/actions";
import { MenuLateral } from "@/components/menu-lateral";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requirePerfil();

  let pendentes = 0;
  if (perfil.papel === "admin") {
    const supabase = await createClient();
    const { count } = await supabase
      .from("avaliacoes")
      .select("id, analises!left(avaliacao_id)", { count: "exact", head: true })
      .is("analises", null);
    pendentes = count ?? 0;
  }

  return (
    <div className="min-h-screen md:flex">
      <MenuLateral nome={perfil.nome} papel={perfil.papel} pendentes={pendentes} sair={sair} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
