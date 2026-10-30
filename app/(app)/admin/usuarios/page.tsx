import { BotaoConfirmar } from "@/components/botao-confirmar";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { alterarPapel, removerUsuario } from "./actions";
import { FormUsuario } from "./form-usuario";

export const metadata = { title: "Usuários · Radar de Concorrentes" };

export default async function UsuariosPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: perfis } = await supabase.from("perfis").select("user_id, nome, email, papel").order("nome");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold text-marinho">Usuários</h1>

      <FormUsuario />

      <div className="cartao overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Usuários cadastrados</caption>
          <thead className="border-b border-borda bg-fundo text-texto-suave">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Nome</th>
              <th scope="col" className="px-4 py-3 font-medium">E-mail</th>
              <th scope="col" className="px-4 py-3 font-medium">Papel</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {perfis?.map((p) => {
              const euMesmo = p.user_id === admin.user_id;
              return (
                <tr key={p.user_id}>
                  <th scope="row" className="px-4 py-3 font-medium">{p.nome}{euMesmo && " (você)"}</th>
                  <td className="px-4 py-3">{p.email}</td>
                  <td className="px-4 py-3">
                    {euMesmo ? (
                      "Administrador"
                    ) : (
                      <form action={alterarPapel} className="flex items-center gap-2">
                        <input type="hidden" name="user_id" value={p.user_id} />
                        <label htmlFor={`papel-${p.user_id}`} className="sr-only">Papel de {p.nome}</label>
                        <select id={`papel-${p.user_id}`} name="papel" defaultValue={p.papel} className="campo w-auto py-1">
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Administrador</option>
                        </select>
                        <button type="submit" className="btn-secundario px-3 py-1">Salvar</button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!euMesmo && (
                      <form action={removerUsuario}>
                        <input type="hidden" name="user_id" value={p.user_id} />
                        <BotaoConfirmar className="text-laranja underline" mensagem={`Remover o acesso de ${p.nome}?`}>
                          Remover<span className="sr-only"> {p.nome}</span>
                        </BotaoConfirmar>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
