import { entrar } from "./actions";

export const metadata = { title: "Entrar · Radar de Concorrentes" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-marinho px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-marinho">Radar de Concorrentes</h1>
        <p className="mt-1 text-sm text-texto-suave">Entre com seu e-mail e senha.</p>

        {erro && (
          <p role="alert" className="mt-4 rounded-md border border-laranja bg-laranja-claro px-3 py-2 text-sm text-laranja">
            {erro}
          </p>
        )}

        <form action={entrar} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="rotulo">E-mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
          </div>
          <div>
            <label htmlFor="senha" className="rotulo">Senha</label>
            <input id="senha" name="senha" type="password" autoComplete="current-password" required className="campo" />
          </div>
          <button type="submit" className="btn-primario w-full">Entrar</button>
        </form>
      </div>
    </main>
  );
}
