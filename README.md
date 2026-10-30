# Radar de Concorrentes

Ferramenta de inteligência competitiva: reúne avaliações dos softwares concorrentes, classifica com IA os pontos positivos e negativos por tema e transforma isso em battle cards para o time comercial.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth) · Recharts. Hospedagem prevista: Cloudflare. Código no GitHub.

A classificação das avaliações é **manual** por enquanto (tela *Classificar avaliações*). A análise por IA pode ser ligada depois sem mudar o banco: toda análise passa por `salvarAnalise()` em `lib/analise.ts`, que registra quem/qual modelo classificou.

## Status das etapas

| Etapa | Conteúdo | Status |
|---|---|---|
| a | Autenticação, papéis, cadastro de concorrentes e usuários | ✅ |
| b | Fontes, importação manual (CSV / colar texto) e classificação manual | ✅ (IA adiada) |
| c | Perfil do concorrente | pendente |
| d | Painel geral | pendente |
| e | Comparativo | pendente |
| f | Battle card (rascunho por IA, PDF, link) | pendente |
| g | Registro de campo | pendente |
| h | Coletores automáticos e alertas | pendente |

## Instalação (ambiente local)

Pré-requisitos: Node.js 20+ e Docker em execução.

```bash
npm install
npx supabase start          # sobe Postgres/Auth locais, aplica migrations e seed
npx supabase status         # mostra URL e chaves
cp .env.example .env.local  # preencha com os valores do status
npm run dev                 # http://localhost:3000
```

> As portas do Supabase local deste projeto ficam na faixa **553xx** (API em `http://127.0.0.1:55321`, Studio em `http://127.0.0.1:55323`) para não conflitar com outros projetos Supabase na mesma máquina.

Para recriar o banco do zero (migrations + seed): `npx supabase db reset`.

### Testes

```bash
npm run teste:rls          # regras de acesso, trigger de perfil, deduplicação
npm run teste:importacao   # parser de CSV, conversões, importação e análise
```

Ambos usam o Supabase local com o seed aplicado.

### Usuários de teste (seed)

| E-mail | Senha | Papel |
|---|---|---|
| admin@radar.local | radar123 | Administrador |
| vendedor@radar.local | radar123 | Vendedor |

O seed também cria 3 concorrentes fictícios (MesaFácil, ComandaPro, Cardápio360) e o “Nosso software”, com fontes, avaliações já analisadas, dados da empresa e registros de campo.

## Variáveis de ambiente

| Variável | Onde é usada | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador e servidor | URL da API do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador e servidor | chave pública; o acesso é protegido por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor** | criação de usuários e tarefas agendadas; nunca expor |
| `OPENROUTER_API_KEY` | **somente servidor** | opcional; se definida, tem prioridade sobre a chave salva na tela Configurações |
| `OPENROUTER_MODEL` | **somente servidor** | opcional; modelo usado na pesquisa (ex.: `anthropic/claude-sonnet-5.5`) |
| `NEXT_PUBLIC_APP_URL` | servidor | base dos links de compartilhamento |

Chaves nunca vão para o código nem para o git (`.env*` está no `.gitignore`, exceto `.env.example`).

## Permissões

- **Administrador**: cadastra concorrentes, fontes e usuários; edita battle cards.
- **Vendedor**: consulta tudo e cria registros de campo (edita apenas os próprios).

As regras valem no banco (Row Level Security), não só na interface. O cadastro público está desligado: usuários são criados pelo administrador em **Administração → Usuários**. O papel é gravado em `app_metadata`, que o próprio usuário não consegue alterar.

## Estrutura

```
app/(auth)/login         login e logout
app/(app)/…              telas autenticadas (menu lateral)
app/(app)/admin/…        telas de administração
lib/supabase/server.ts   clientes Supabase (sessão do usuário e service role)
lib/auth.ts              perfil logado, requirePerfil / requireAdmin
supabase/migrations/     schema, tipos e políticas RLS
supabase/seed.sql        dados de exemplo
```

## Pesquisa automática de concorrentes (OpenRouter)

1. Crie uma chave em [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) e adicione créditos.
2. Em **Administração → Configurações**, cole a chave e escolha o modelo. A chave é validada antes de ser salva.
3. Em **Concorrentes → Novo concorrente**, digite o nome e clique em **Pesquisar na web**.

A pesquisa usa o plugin de busca web da OpenRouter com o motor **Exa** (uma busca por pesquisa, até 10 resultados) e preenche **apenas campos vazios**, mostrando a fonte de cada dado. As páginas de avaliação encontradas podem ser cadastradas como fontes com um clique; as que não apareceram nos resultados reais da busca vêm desmarcadas e sinalizadas.

A chave salva pela tela fica na tabela `configuracoes`, com RLS sem nenhuma política: nenhum usuário (nem admin) a lê pela API; só o servidor, com a service role.

### Classificação automática

Com a OpenRouter configurada, as avaliações importadas são classificadas pela IA em segundo plano (lotes de 10). Também há o botão **Classificar pendentes com IA** em *Classificar avaliações*. A IA usa somente os temas da tabela `temas`; nada é reanalisado. As classificações da IA ficam em **Revisar classificações da IA** até um admin confirmar ou corrigir (`analises.revisado_em`).

### Custos medidos (out/2026, `anthropic/claude-sonnet-5.5`)

| Operação | Custo aproximado |
|---|---|
| Pesquisa de um concorrente | US$ 0,03 |
| Classificação de uma avaliação | US$ 0,0013 (menos com um modelo Haiku) |

Toda chamada envia `max_tokens`. Sem ele, a OpenRouter reserva o custo máximo do modelo e recusa a chamada (402) quando o saldo está baixo. O custo real de cada pesquisa e de cada lote aparece na tela.

## Importação de avaliações

Em **Administração → Fontes e coletas**, cadastre a fonte e clique em **Importar**:

- **Colar texto**: uma avaliação por bloco, separadas por uma linha em branco.
- **CSV** (`;` ou `,`, até 4 MB / 2.000 linhas): coluna `texto` obrigatória; `data` (DD/MM/AAAA ou AAAA-MM-DD), `nota`, `url` e `cargo` opcionais.

Notas são guardadas em **0 a 5 estrelas**; valores entre 5 e 10 são tratados como escala 0–10 e divididos por 2. Não importe nome, e-mail ou telefone dos autores — no máximo cargo/segmento.

Depois, classifique em **Administração → Classificar avaliações** (sentimento, temas e resumo de até 15 palavras). Cada avaliação é classificada uma única vez.

Avaliações duplicadas são barradas no banco: `avaliacoes.hash` é gerado a partir do texto normalizado (minúsculas, espaços colapsados) e há `UNIQUE (fonte_id, hash)`.

## Como adicionar uma nova fonte de coleta

*(Detalhado na etapa h, quando o módulo de coletores for entregue.)*
