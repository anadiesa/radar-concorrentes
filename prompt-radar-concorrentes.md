# Prompt de desenvolvimento — Radar de Concorrentes

> Cole este prompt na ferramenta de desenvolvimento que for usar (Claude Code, Lovable, Bolt, Cursor etc.). Os trechos entre [colchetes] são para você preencher antes.

---

Você é um desenvolvedor full-stack sênior. Quero construir uma aplicação web chamada **Radar de Concorrentes**, uma ferramenta de inteligência competitiva para uma empresa que faz **representação de softwares** [segmento: ex. sistemas para restaurantes]. O objetivo é descobrir os **pontos positivos e negativos dos softwares concorrentes** e transformar isso em argumentos de venda para o nosso time comercial.

Toda a interface deve ser em **português do Brasil**.

## 1. Stack sugerida
- Front-end: Next.js (App Router) + TypeScript + Tailwind CSS
- Banco e autenticação: Supabase (Postgres + Auth)
- IA para análise de textos: API do Claude (Anthropic)
- Gráficos: Recharts
- Tarefas agendadas (coleta periódica): cron do Supabase ou da hospedagem (Vercel)

Se achar que outra stack é mais adequada, explique o motivo antes de mudar.

## 2. Usuários e permissões
- **Administrador**: cadastra concorrentes, fontes e usuários; edita battle cards.
- **Vendedor**: consulta tudo e cria registros de campo.
- Login com e-mail e senha.

## 3. Modelo de dados (mínimo)
- `concorrentes`: id, nome, site, segmento, logo, observações, ativo
- `fontes`: id, concorrente_id, tipo (b2bstack, g2, capterra, reclame_aqui, google_play, app_store, outro), url, última_coleta
- `avaliacoes`: id, concorrente_id, fonte_id, data, nota (opcional), texto_original, url_original, autor_cargo (se houver), hash (para evitar duplicadas)
- `analises`: avaliacao_id, sentimento (positivo/negativo/neutro), temas (lista), resumo_curto
- `temas`: lista fixa e editável — Usabilidade, Suporte, Preço, Estabilidade, Integrações, Implantação, App mobile, Relatórios, Cobrança/cancelamento
- `dados_empresa`: concorrente_id, tempo_de_mercado, funcionarios, vagas_abertas, nota_glassdoor, reputacao_reclame_aqui, ultimo_investimento, atualizado_em (preenchimento manual no início)
- `registros_campo`: id, usuario_id, concorrente_id, cliente, situacao (ganho, perdido, em negociação, veio do concorrente), temas, texto, data
- `battle_cards`: concorrente_id, resumo, fortes, fracos, objecoes (lista de {cliente_diz, voce_responde}), perguntas, provas, revisado_em

## 4. Telas (seguir o protótipo em anexo)
1. **Painel geral**: indicadores (concorrentes monitorados, avaliações analisadas, registros de campo, alertas), tabela de concorrentes com nota média, barra de sentimento positivo/negativo, tema mais elogiado, tema mais criticado e tendência; alertas da semana; ranking das reclamações mais comuns do mercado. Filtro de período.
2. **Perfil do concorrente**: cabeçalho com nota, nº de avaliações e % positivas/negativas; duas colunas "Pontos positivos" e "Pontos negativos" agrupados por tema com nº de menções e resumo; sentimento por tema; dados da empresa; fontes usadas com data da coleta; botão "Gerar battle card". Ao clicar num tema, listar as avaliações originais com link para a fonte.
3. **Comparativo lado a lado**: matriz tema × concorrente (incluindo "Nosso software") com % positivo e mapa de calor; seleção de quais concorrentes comparar; bloco "Onde ganhamos e onde perdemos".
4. **Battle card**: resumo em uma frase, onde são fortes, onde são fracos, objeções e respostas, perguntas para fazer ao cliente, provas. Editável pelo admin, exportável em PDF e com link para compartilhar.
5. **Registro de campo**: formulário rápido (concorrente, cliente, situação, temas, o que o cliente disse) + lista de registros recentes. Precisa funcionar bem no celular.
6. **Fontes e coletas** (admin): cadastro de concorrentes e fontes, status da última coleta, botão "coletar agora" e importação de avaliações por CSV ou colando texto.

Paleta: azul-marinho #14213D (menu), azul #1D4ED8 (positivo/ações), laranja #C2410C (negativo), fundo #F4F5F7. Fonte IBM Plex Sans. Nunca diferenciar positivo/negativo só pela cor: sempre com texto ou número junto.

## 5. Coleta de dados
- **Fase 1 (MVP)**: entrada manual — colar avaliações, importar CSV e registros de campo. Isso já deve funcionar de ponta a ponta.
- **Fase 2**: coletores automáticos por fonte, um módulo por fonte, executados por agendamento diário. Usar APIs oficiais ou serviços de dados autorizados sempre que existirem. **Respeitar os termos de uso e o robots.txt de cada site**; se uma fonte proibir coleta automática, deixar essa fonte apenas com importação manual.
- Não coletar dados pessoais desnecessários dos autores das avaliações (guardar no máximo cargo/segmento).
- Evitar duplicadas pelo hash do texto + fonte.

## 6. Análise com IA
Para cada avaliação nova, chamar a API do Claude e pedir um JSON com:
```json
{"sentimento": "positivo|negativo|neutro", "temas": ["Suporte", "Preço"], "resumo_curto": "até 15 palavras"}
```
- Usar somente os temas da tabela `temas`.
- Processar em lote e guardar o resultado; nunca reanalisar o que já foi analisado.
- Gerar o **rascunho do battle card** a partir dos temas mais citados + registros de campo, para o admin revisar antes de publicar.
- Alertas automáticos: aumento acima de [X]% nas reclamações de um tema em 7 dias, mudança de nota média, novo registro de "negócio perdido".

## 7. Requisitos gerais
- Responsivo (registro de campo e battle card precisam ser ótimos no celular).
- Acessível: contraste adequado, labels em todos os campos, navegação por teclado.
- Toda informação exibida deve mostrar a fonte e a data da coleta.
- Variáveis sensíveis (chaves de API) apenas em variáveis de ambiente.
- Dados de exemplo (seed) com 3 concorrentes fictícios para testar as telas.

## 8. Como quero que você trabalhe
1. Primeiro me apresente o plano: estrutura de pastas, schema do banco e ordem de entrega. Espere minha aprovação.
2. Entregue por etapas, nesta ordem: (a) autenticação + cadastro de concorrentes; (b) importação manual + análise com IA; (c) perfil do concorrente; (d) painel geral; (e) comparativo; (f) battle card; (g) registro de campo; (h) coletores automáticos e alertas.
3. Ao fim de cada etapa, diga como testar e o que falta.
4. Escreva um README com instalação, variáveis de ambiente e como adicionar uma nova fonte de coleta.
