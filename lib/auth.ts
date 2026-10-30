import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Papel = "admin" | "vendedor";

export type Perfil = {
  user_id: string;
  nome: string;
  email: string;
  papel: Papel;
};

/** Perfil do usuário logado (uma consulta por requisição). */
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfis")
    .select("user_id, nome, email, papel")
    .eq("user_id", user.id)
    .single();
  return data;
});

export async function requirePerfil(): Promise<Perfil> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  return perfil;
}

export async function requireAdmin(): Promise<Perfil> {
  const perfil = await requirePerfil();
  if (perfil.papel !== "admin") redirect("/painel");
  return perfil;
}
