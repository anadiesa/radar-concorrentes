"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type Papel } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export type EstadoUsuario = { erro?: string; ok?: string };

const PAPEIS: Papel[] = ["admin", "vendedor"];

export async function criarUsuario(_: EstadoUsuario, formData: FormData): Promise<EstadoUsuario> {
  await requireAdmin();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const papel = String(formData.get("papel")) as Papel;

  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (senha.length < 8) return { erro: "A senha inicial precisa ter pelo menos 8 caracteres." };
  if (!PAPEIS.includes(papel)) return { erro: "Papel inválido." };

  // O papel vai em app_metadata: o usuário não consegue alterá-lo. O trigger cria o perfil.
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
    app_metadata: { papel },
  });
  if (error) {
    return { erro: error.message.includes("already") ? "Já existe um usuário com esse e-mail." : error.message };
  }

  revalidatePath("/admin/usuarios");
  return { ok: `Usuário ${email} criado. Envie a senha inicial por um canal seguro.` };
}

export async function alterarPapel(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id"));
  const papel = String(formData.get("papel")) as Papel;
  if (!PAPEIS.includes(papel) || userId === admin.user_id) return;

  const supabase = createAdminClient();
  await supabase.from("perfis").update({ papel }).eq("user_id", userId);
  await supabase.auth.admin.updateUserById(userId, { app_metadata: { papel } });
  revalidatePath("/admin/usuarios");
}

export async function removerUsuario(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("user_id"));
  if (userId === admin.user_id) return;

  await createAdminClient().auth.admin.deleteUser(userId);
  revalidatePath("/admin/usuarios");
}
