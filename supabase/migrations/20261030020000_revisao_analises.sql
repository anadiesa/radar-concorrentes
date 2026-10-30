-- Revisão humana das análises feitas pela IA.
alter table analises
  add column revisado_em timestamptz,
  add column revisado_por uuid references perfis (user_id) on delete set null;

-- Classificações manuais já nascem revisadas.
update analises set revisado_em = analisado_em where modelo in ('manual', 'seed');

create index analises_pendentes_revisao on analises (analisado_em) where revisado_em is null;
