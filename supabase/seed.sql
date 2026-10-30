-- Dados de exemplo — 3 concorrentes fictícios + "Nosso software", segmento: sistemas para restaurantes.
-- Usuários de teste (senha: radar123):
--   admin@radar.local     (administrador)
--   vendedor@radar.local  (vendedor)

-- ---------------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-0000-0000-0000000000a1'::uuid, 'admin@radar.local', 'Ana Admin', 'admin'),
      ('00000000-0000-0000-0000-0000000000a2'::uuid, 'vendedor@radar.local', 'Victor Vendedor', 'vendedor')
    ) as t (id, email, nome, papel)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      crypt('radar123', gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email'], 'papel', u.papel),
      jsonb_build_object('nome', u.nome), now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now());
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Temas
-- ---------------------------------------------------------------------------
insert into temas (nome, descricao) values
  ('Usabilidade', 'Facilidade de uso, interface, curva de aprendizado'),
  ('Suporte', 'Atendimento, tempo de resposta, qualidade do suporte'),
  ('Preço', 'Custo, reajustes, custo-benefício'),
  ('Estabilidade', 'Quedas, lentidão, bugs, sistema fora do ar'),
  ('Integrações', 'iFood, TEF, fiscal, delivery, ERPs e APIs'),
  ('Implantação', 'Onboarding, treinamento, migração de dados'),
  ('App mobile', 'Aplicativo de garçom, gestor ou cliente'),
  ('Relatórios', 'Relatórios gerenciais, indicadores, exportação'),
  ('Cobrança/cancelamento', 'Multas, fidelidade, cobranças indevidas, dificuldade para cancelar');

-- ---------------------------------------------------------------------------
-- Concorrentes
-- ---------------------------------------------------------------------------
insert into concorrentes (id, nome, site, segmento, observacoes, e_nosso) values
  ('10000000-0000-0000-0000-000000000000', 'Nosso software', 'https://exemplo.com.br', 'Sistemas para restaurantes', 'Nosso produto, usado como referência no comparativo.', true),
  ('10000000-0000-0000-0000-000000000001', 'MesaFácil', 'https://mesafacil.exemplo', 'Sistemas para restaurantes', 'Líder em restaurantes de médio porte. Forte em PDV.', false),
  ('10000000-0000-0000-0000-000000000002', 'ComandaPro', 'https://comandapro.exemplo', 'Sistemas para restaurantes', 'Foco em bares e comanda eletrônica. Preço agressivo.', false),
  ('10000000-0000-0000-0000-000000000003', 'Cardápio360', 'https://cardapio360.exemplo', 'Sistemas para restaurantes', 'Nascido no delivery; cresceu rápido com investimento.', false);

insert into fontes (id, concorrente_id, tipo, url, modo, ultima_coleta, status_ultima_coleta) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'reclame_aqui', 'https://www.reclameaqui.com.br/empresa/mesafacil-exemplo/', 'manual', now() - interval '2 days', 'sucesso'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'capterra', 'https://www.capterra.com.br/software/000000/mesafacil', 'manual', now() - interval '5 days', 'sucesso'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'google_play', 'https://play.google.com/store/apps/details?id=exemplo.comandapro', 'manual', now() - interval '1 day', 'sucesso'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'reclame_aqui', 'https://www.reclameaqui.com.br/empresa/comandapro-exemplo/', 'manual', now() - interval '3 days', 'sucesso'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'app_store', 'https://apps.apple.com/br/app/cardapio360/id000000000', 'automatico', now() - interval '1 day', 'sucesso'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'b2bstack', 'https://www.b2bstack.com.br/product/cardapio360-exemplo', 'manual', now() - interval '6 days', 'sucesso'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000000', 'capterra', 'https://www.capterra.com.br/software/000000/nosso', 'manual', now() - interval '4 days', 'sucesso');

-- ---------------------------------------------------------------------------
-- Avaliações já analisadas (texto fictício)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_id uuid;
  v_conc uuid;
begin
  for r in
    select * from (values
      -- MesaFácil
      ('20000000-0000-0000-0000-000000000001', 3,  1.0, 'Gerente de loja', 'Sistema caiu em plena sexta à noite e o suporte só respondeu na segunda. Perdemos vendas.', 'negativo', array['Estabilidade','Suporte'], 'Queda na sexta e suporte demorou até segunda'),
      ('20000000-0000-0000-0000-000000000001', 6,  2.0, null,              'Tentei cancelar e cobraram multa de fidelidade que não estava clara no contrato.', 'negativo', array['Cobrança/cancelamento'], 'Multa de cancelamento não informada'),
      ('20000000-0000-0000-0000-000000000001', 9,  1.0, 'Proprietário',    'Reajuste de 25% sem aviso prévio. Suporte por chat demora horas.', 'negativo', array['Preço','Suporte'], 'Reajuste alto sem aviso e chat lento'),
      ('20000000-0000-0000-0000-000000000001', 14, 2.0, null,              'Lentidão no PDV nos horários de pico, travando a fila do caixa.', 'negativo', array['Estabilidade'], 'PDV lento no horário de pico'),
      ('20000000-0000-0000-0000-000000000001', 30, 3.0, 'Gerente',         'Atendimento demorou para resolver integração com o iFood, mas resolveu.', 'neutro', array['Suporte','Integrações'], 'Integração iFood resolvida, mas com demora'),
      ('20000000-0000-0000-0000-000000000002', 4,  5.0, 'Gerente de operações', 'PDV muito fácil, a equipe aprendeu em um dia. Relatórios de CMV excelentes.', 'positivo', array['Usabilidade','Relatórios'], 'PDV fácil e bons relatórios de CMV'),
      ('20000000-0000-0000-0000-000000000002', 12, 4.0, 'Sócio',           'Integra bem com iFood e com o TEF. Implantação levou duas semanas, dentro do previsto.', 'positivo', array['Integrações','Implantação'], 'Boa integração iFood/TEF e implantação no prazo'),
      ('20000000-0000-0000-0000-000000000002', 20, 4.0, null,              'Interface intuitiva e relatórios completos, só o app do garçom que é fraco.', 'positivo', array['Usabilidade','Relatórios','App mobile'], 'Interface boa, app do garçom fraco'),
      ('20000000-0000-0000-0000-000000000002', 40, 2.0, 'Gerente',         'App do garçom trava e perde pedidos quando o wi-fi oscila.', 'negativo', array['App mobile','Estabilidade'], 'App do garçom perde pedidos sem wi-fi'),
      ('20000000-0000-0000-0000-000000000002', 55, 5.0, 'Proprietária',    'Melhor sistema que já usei, relatórios de vendas por hora ajudam muito na escala.', 'positivo', array['Relatórios'], 'Relatórios por hora ajudam na escala'),
      -- ComandaPro
      ('20000000-0000-0000-0000-000000000003', 2,  5.0, null,              'Comanda no celular funciona muito bem, rápido e barato.', 'positivo', array['App mobile','Preço'], 'App de comanda rápido e barato'),
      ('20000000-0000-0000-0000-000000000003', 5,  4.0, null,              'Preço justo para bar pequeno. Falta relatório de estoque.', 'positivo', array['Preço','Relatórios'], 'Preço bom, falta relatório de estoque'),
      ('20000000-0000-0000-0000-000000000003', 8,  1.0, null,              'Depois da atualização o app fecha sozinho toda hora.', 'negativo', array['App mobile','Estabilidade'], 'App fecha sozinho após atualização'),
      ('20000000-0000-0000-0000-000000000003', 25, 4.0, null,              'Muito fácil de usar, até os garçons mais velhos aprenderam.', 'positivo', array['Usabilidade'], 'Fácil de usar até para quem tem dificuldade'),
      ('20000000-0000-0000-0000-000000000004', 3,  1.0, 'Proprietário',    'Não tem integração fiscal decente, tive problema com NFC-e várias vezes.', 'negativo', array['Integrações'], 'Problemas recorrentes com NFC-e'),
      ('20000000-0000-0000-0000-000000000004', 6,  1.0, null,              'Suporte só por e-mail, nunca consegui falar com ninguém.', 'negativo', array['Suporte'], 'Suporte apenas por e-mail e sem retorno'),
      ('20000000-0000-0000-0000-000000000004', 10, 2.0, null,              'Relatórios muito básicos, preciso exportar para planilha.', 'negativo', array['Relatórios'], 'Relatórios básicos, depende de planilha'),
      ('20000000-0000-0000-0000-000000000004', 35, 3.0, 'Gerente',         'Implantação foi rápida, mas ninguém treinou a equipe.', 'neutro', array['Implantação'], 'Implantação rápida sem treinamento'),
      -- Cardápio360
      ('20000000-0000-0000-0000-000000000005', 1,  5.0, null,              'Cardápio digital lindo e o app de delivery é muito rápido.', 'positivo', array['App mobile','Usabilidade'], 'Cardápio digital bonito e app rápido'),
      ('20000000-0000-0000-0000-000000000005', 4,  4.0, null,              'Integração com iFood e Rappi perfeita, centraliza tudo.', 'positivo', array['Integrações'], 'Centraliza iFood e Rappi'),
      ('20000000-0000-0000-0000-000000000005', 7,  2.0, null,              'Caro demais para o que entrega no salão, focado só em delivery.', 'negativo', array['Preço'], 'Caro e fraco para atendimento no salão'),
      ('20000000-0000-0000-0000-000000000005', 15, 5.0, null,              'Ótimo app, clientes elogiam a facilidade para pedir.', 'positivo', array['App mobile'], 'Clientes elogiam app de pedidos'),
      ('20000000-0000-0000-0000-000000000006', 2,  2.0, 'Diretor financeiro', 'Implantação atrasou um mês e a migração de cadastros veio com erro.', 'negativo', array['Implantação'], 'Implantação atrasou e migração com erros'),
      ('20000000-0000-0000-0000-000000000006', 5,  2.0, 'Gerente de TI',   'Cobram por cada módulo, a conta final ficou o dobro do orçamento.', 'negativo', array['Preço','Cobrança/cancelamento'], 'Cobrança por módulo dobrou o custo'),
      ('20000000-0000-0000-0000-000000000006', 9,  4.0, 'Gerente de marketing', 'Relatórios de delivery por bairro são muito úteis.', 'positivo', array['Relatórios'], 'Bons relatórios de delivery por bairro'),
      ('20000000-0000-0000-0000-000000000006', 45, 3.0, null,              'Suporte educado mas demora para escalar problemas técnicos.', 'neutro', array['Suporte'], 'Suporte cordial porém lento para escalar'),
      -- Nosso software
      ('20000000-0000-0000-0000-000000000007', 3,  5.0, 'Proprietário',    'Suporte 24h pelo WhatsApp resolve na hora, mesmo no fim de semana.', 'positivo', array['Suporte'], 'Suporte 24h no WhatsApp eficiente'),
      ('20000000-0000-0000-0000-000000000007', 8,  4.0, 'Gerente',         'Sistema estável, em um ano não tivemos queda. Relatórios poderiam ser melhores.', 'positivo', array['Estabilidade','Relatórios'], 'Estável, relatórios podem melhorar'),
      ('20000000-0000-0000-0000-000000000007', 20, 3.0, null,              'App do garçom é bom mas a interface do retaguarda é confusa.', 'neutro', array['App mobile','Usabilidade'], 'App bom, retaguarda confusa'),
      ('20000000-0000-0000-0000-000000000007', 33, 5.0, 'Sócia',           'Implantação acompanhada presencialmente, equipe treinada em dois dias.', 'positivo', array['Implantação'], 'Implantação presencial e treinamento rápido')
    ) as t (fonte_id, dias_atras, nota, cargo, texto, sent, temas_nomes, resumo)
  loop
    select concorrente_id into v_conc from fontes where id = r.fonte_id::uuid;

    insert into avaliacoes (concorrente_id, fonte_id, data, nota, texto_original, url_original, autor_cargo, coletada_em)
    values (v_conc, r.fonte_id::uuid, current_date - r.dias_atras, r.nota, r.texto,
            (select url from fontes where id = r.fonte_id::uuid), r.cargo, now() - (r.dias_atras || ' days')::interval)
    returning id into v_id;

    insert into analises (avaliacao_id, sentimento, resumo_curto, modelo)
    values (v_id, r.sent::sentimento, r.resumo, 'seed');

    insert into analise_temas (avaliacao_id, tema_id)
    select v_id, id from temas where nome = any (r.temas_nomes);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Dados da empresa (preenchimento manual)
-- ---------------------------------------------------------------------------
insert into dados_empresa (concorrente_id, tempo_de_mercado, funcionarios, vagas_abertas, nota_glassdoor, reputacao_reclame_aqui, ultimo_investimento, fonte) values
  ('10000000-0000-0000-0000-000000000001', '12 anos', '200–500', 14, 3.4, 'Regular (6,1)', 'Não divulgado', 'Site institucional e LinkedIn (exemplo)'),
  ('10000000-0000-0000-0000-000000000002', '5 anos', '50–100', 3, 3.9, 'Ruim (4,8)', 'Seed R$ 4 mi (2023)', 'LinkedIn e Crunchbase (exemplo)'),
  ('10000000-0000-0000-0000-000000000003', '4 anos', '100–200', 22, 4.1, 'Bom (7,4)', 'Série A R$ 40 mi (2025)', 'Imprensa e Crunchbase (exemplo)');

-- ---------------------------------------------------------------------------
-- Registros de campo
-- ---------------------------------------------------------------------------
insert into registros_campo (usuario_id, concorrente_id, cliente, situacao, temas, texto, data) values
  ('00000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-000000000001', 'Cantina do Bairro', 'veio_do_concorrente',
    array(select id from temas where nome in ('Suporte', 'Estabilidade')), 'Saiu do MesaFácil porque o sistema caía no fim de semana e ninguém atendia.', current_date - 4),
  ('00000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-000000000003', 'Burger Norte', 'perdido',
    array(select id from temas where nome in ('Integrações', 'App mobile')), 'Escolheu o Cardápio360 pelo app de delivery próprio e integração com Rappi.', current_date - 2),
  ('00000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-000000000002', 'Bar do Zé', 'em_negociacao',
    array(select id from temas where nome in ('Preço')), 'Acha o ComandaPro mais barato; mostramos o problema de NFC-e.', current_date - 1);
