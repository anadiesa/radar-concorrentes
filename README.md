# Radar de Concorrentes

Ferramenta de inteligência competitiva: reúne avaliações dos softwares concorrentes, classifica com IA os pontos positivos e negativos por tema e transforma isso em battle cards para o time comercial.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth) · API do Claude · Recharts.

## Status das etapas

| Etapa | Conteúdo | Status |
|---|---|---|
| a | Autenticação, papéis, cadastro de concorrentes e usuários | ✅ |
| b | Importação manual (CSV / colar texto) + análise com IA | pendente |
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
| `ANTHROPIC_API_KEY` | **somente servidor** | análise de avaliações e rascunho de battle card (etapa b) |
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

Avaliações duplicadas são barradas no banco: `avaliacoes.hash` é gerado a partir do texto normalizado (minúsculas, espaços colapsados) e há `UNIQUE (fonte_id, hash)`.

## Como adicionar uma nova fonte de coleta

*(Detalhado na etapa h, quando o módulo de coletores for entregue.)*
