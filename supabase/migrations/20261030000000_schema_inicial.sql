-- Radar de Concorrentes — schema inicial
-- Todas as tabelas do modelo ficam aqui desde já; as telas que as usam chegam por etapas.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type papel_usuario as enum ('admin', 'vendedor');
create type tipo_fonte as enum ('b2bstack', 'g2', 'capterra', 'reclame_aqui', 'google_play', 'app_store', 'outro');
create type modo_fonte as enum ('manual', 'automatico');
create type status_coleta as enum ('nunca', 'executando', 'sucesso', 'erro');
create type sentimento as enum ('positivo', 'negativo', 'neutro');
create type situacao_campo as enum ('ganho', 'perdido', 'em_negociacao', 'veio_do_concorrente');
create type status_battle_card as enum ('rascunho', 'publicado');
create type tipo_alerta as enum ('alta_reclamacoes_tema', 'mudanca_nota', 'negocio_perdido');

-- ---------------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------------
create table perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null default '',
  papel papel_usuario not null default 'vendedor',
  criado_em timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfis where user_id = auth.uid() and papel = 'admin');
$$;

-- Cria o perfil automaticamente quando um usuário é criado no Auth.
-- O papel vem de raw_app_meta_data (só o service role consegue definir), nunca do usuário.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis (user_id, nome, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    coalesce((new.raw_app_meta_data ->> 'papel')::papel_usuario, 'vendedor')
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------------
-- Concorrentes e fontes
-- ---------------------------------------------------------------------------
create table concorrentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  site text,
  segmento text,
  logo text,
  observacoes text,
  ativo boolean not null default true,
  e_nosso boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Só pode existir um "Nosso software".
create unique index concorrentes_um_nosso on concorrentes (e_nosso) where e_nosso;

create table fontes (
  id uuid primary key default gen_random_uuid(),
  concorrente_id uuid not null references concorrentes (id) on delete cascade,
  tipo tipo_fonte not null,
  url text,
  modo modo_fonte not null default 'manual',
  ultima_coleta timestamptz,
  status_ultima_coleta status_coleta not null default 'nunca',
  criado_em timestamptz not null default now()
);
create index on fontes (concorrente_id);

create table coletas (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references fontes (id) on delete cascade,
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  status status_coleta not null default 'executando',
  novas int not null default 0,
  duplicadas int not null default 0,
  erro text
);
create index on coletas (fonte_id, iniciada_em desc);

-- ---------------------------------------------------------------------------
-- Avaliações e análises
-- ---------------------------------------------------------------------------
-- Hash do texto normalizado (minúsculas, espaços colapsados). O banco é sempre UTF-8,
-- então a função é de fato imutável e pode ser usada em coluna gerada.
create or replace function public.hash_texto(t text)
returns text
language sql
immutable
parallel safe
as $$
  select encode(sha256(convert_to(regexp_replace(lower(btrim(t)), '\s+', ' ', 'g'), 'UTF8')), 'hex');
$$;

create table avaliacoes (
  id uuid primary key default gen_random_uuid(),
  concorrente_id uuid not null references concorrentes (id) on delete cascade,
  fonte_id uuid not null references fontes (id) on delete cascade,
  data date,
  nota numeric(2, 1) check (nota is null or (nota >= 0 and nota <= 5)), -- 0 a 5 estrelas
  texto_original text not null,
  url_original text,
  autor_cargo text,
  -- Hash do texto normalizado (minúsculas, espaços colapsados): evita duplicadas por fonte.
  hash text generated always as (public.hash_texto(texto_original)) stored,
  coletada_em timestamptz not null default now(),
  unique (fonte_id, hash)
);
create index on avaliacoes (concorrente_id, data desc);

create table temas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ativo boolean not null default true
);

create table analises (
  avaliacao_id uuid primary key references avaliacoes (id) on delete cascade,
  sentimento sentimento not null,
  resumo_curto text not null,
  modelo text not null,
  analisado_em timestamptz not null default now()
);

create table analise_temas (
  avaliacao_id uuid not null references analises (avaliacao_id) on delete cascade,
  tema_id uuid not null references temas (id) on delete cascade,
  primary key (avaliacao_id, tema_id)
);
create index on analise_temas (tema_id);

-- ---------------------------------------------------------------------------
-- Dados da empresa, campo, battle cards, alertas
-- ---------------------------------------------------------------------------
create table dados_empresa (
  concorrente_id uuid primary key references concorrentes (id) on delete cascade,
  tempo_de_mercado text,
  funcionarios text,
  vagas_abertas int,
  nota_glassdoor numeric(2, 1),
  reputacao_reclame_aqui text,
  ultimo_investimento text,
  fonte text,
  atualizado_em timestamptz not null default now()
);

create table registros_campo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references perfis (user_id) on delete cascade,
  concorrente_id uuid not null references concorrentes (id) on delete cascade,
  cliente text not null,
  situacao situacao_campo not null,
  temas uuid[] not null default '{}',
  texto text not null,
  data date not null default current_date,
  criado_em timestamptz not null default now()
);
create index on registros_campo (concorrente_id, data desc);

create table battle_cards (
  concorrente_id uuid primary key references concorrentes (id) on delete cascade,
  status status_battle_card not null default 'rascunho',
  resumo text not null default '',
  fortes jsonb not null default '[]',
  fracos jsonb not null default '[]',
  objecoes jsonb not null default '[]', -- [{cliente_diz, voce_responde}]
  perguntas jsonb not null default '[]',
  provas jsonb not null default '[]',
  share_token text unique,
  revisado_em timestamptz,
  revisado_por uuid references perfis (user_id) on delete set null,
  atualizado_em timestamptz not null default now()
);

create table alertas (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_alerta not null,
  concorrente_id uuid not null references concorrentes (id) on delete cascade,
  tema_id uuid references temas (id) on delete set null,
  detalhe jsonb not null default '{}',
  criado_em timestamptz not null default now(),
  lido boolean not null default false
);
create index on alertas (criado_em desc);

-- ---------------------------------------------------------------------------
-- RLS: autenticado lê tudo; admin escreve; vendedor cria/edita os próprios registros de campo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'perfis', 'concorrentes', 'fontes', 'coletas', 'avaliacoes', 'temas', 'analises',
    'analise_temas', 'dados_empresa', 'registros_campo', 'battle_cards', 'alertas'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "leitura autenticada" on %I for select to authenticated using (true)', t);
  end loop;

  foreach t in array array[
    'concorrentes', 'fontes', 'coletas', 'avaliacoes', 'temas', 'analises',
    'analise_temas', 'dados_empresa', 'battle_cards', 'alertas'
  ] loop
    execute format(
      'create policy "admin escreve" on %I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

create policy "admin gerencia perfis" on perfis for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "cria o próprio registro" on registros_campo for insert to authenticated
  with check (usuario_id = auth.uid());
create policy "edita o próprio registro ou admin" on registros_campo for update to authenticated
  using (usuario_id = auth.uid() or public.is_admin())
  with check (usuario_id = auth.uid() or public.is_admin());
create policy "apaga o próprio registro ou admin" on registros_campo for delete to authenticated
  using (usuario_id = auth.uid() or public.is_admin());

-- Qualquer usuário pode marcar alertas como lidos (e só essa coluna).
create policy "marca alerta como lido" on alertas for update to authenticated
  using (true) with check (true);
revoke update on alertas from authenticated;
grant update (lido) on alertas to authenticated;
