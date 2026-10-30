-- Configurações do sistema (ex.: chave da OpenRouter).
-- RLS ligado e SEM políticas: nenhum usuário (nem admin) lê esta tabela pela API.
-- Só o servidor, com a service role, acessa — e só depois de checar que quem pediu é admin.
create table configuracoes (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references perfis (user_id) on delete set null
);

alter table configuracoes enable row level security;
revoke all on configuracoes from anon, authenticated;
