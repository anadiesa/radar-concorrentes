"use client";

/** Botão de envio que pede confirmação antes de submeter o formulário. */
export function BotaoConfirmar({
  mensagem,
  className,
  children,
}: {
  mensagem: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(mensagem)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
