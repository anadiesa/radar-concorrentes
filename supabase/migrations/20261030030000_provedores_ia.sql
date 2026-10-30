-- Vários provedores de IA: a escolha de provedor e modelo passa a ser por tarefa.
-- Converte as chaves antigas (só OpenRouter) para os nomes novos.

update configuracoes set chave = 'ia_pesquisa_modelo' where chave = 'openrouter_modelo';
update configuracoes set chave = 'ia_classificacao_modelo' where chave = 'openrouter_modelo_classificacao';

-- Quem já usava a OpenRouter continua usando nas duas tarefas.
insert into configuracoes (chave, valor)
select v.chave, 'openrouter'
from (values ('ia_pesquisa_provedor'), ('ia_classificacao_provedor')) as v (chave)
where exists (select 1 from configuracoes where chave = 'openrouter_api_key')
on conflict (chave) do nothing;

-- Classificação sem modelo próprio usava o de pesquisa (caro). Passa ao modelo barato testado.
insert into configuracoes (chave, valor)
select 'ia_classificacao_modelo', 'deepseek/deepseek-v4-flash'
where exists (select 1 from configuracoes where chave = 'ia_classificacao_provedor' and valor = 'openrouter')
on conflict (chave) do nothing;
