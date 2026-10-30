import { sair } from "@/app/(auth)/login/actions";
import { MenuLateral } from "@/components/menu-lateral";
import { requirePerfil } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requirePerfil();

  return (
    <div className="min-h-screen md:flex">
      <MenuLateral nome={perfil.nome} papel={perfil.papel} sair={sair} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
