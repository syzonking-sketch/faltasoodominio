# Remix of The Match

Atue como Senior Software Architect, Full-Stack Developer, Product Manager, UX/UI Designer, PWA Specialist, React/TypeScript Specialist, Supabase/PostgreSQL Specialist e Security Engineer. 

Construa uma aplicação web mobile-first completa chamada "The Match", projetada estritamente como um PWA (Progressive Web App) instalável, responsiva de 320px até telas ultrawide desktop, utilizando React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod e Supabase.

---

### 1. CONCEITO E OBJETIVO DO APLICATIVO

"The Match" é a plataforma definitiva de futebol amador e de várzea em tempo real. Funciona com um mapa interativo estilo GPS/Pokémon GO onde quadras e campos exibem partidas ativas criadas e encerradas pelos próprios usuários. O app integra:

- Mapeamento de partidas ao vivo com separação de papéis (Jogadores e Telespectadores).

- Sistema de reputação e notas (estrelas de 1 a 5 tipo Uber) validadas por geolocalização e voto único por usuário, com pesos maiores para avaliações de adversários pós-partida.

- Gestão de Times ("Clãs") com convites, solicitações de entrada e agendamento de confrontos ("contra") entre equipes.

- Mecanismo robusto de validação cruzada de placar entre capitães, auditado em tempo real pela torcida/telespectadores, resultando em anulação automática se houver conflito sem consenso.

- Rankings locais, estaduais e globais (estilo Gran Turismo) servindo como vitrine de dados para olheiros profissionais.

---

### 2. DESIGN SYSTEM E UX/UI (MOBILE-FIRST)

- Layout otimizado para dispositivos móveis com navegação inferior fixa (Bottom Navigation Bar) contendo abas: Mapa/Radar, Partidas, Times, Ranking e Perfil.

- Tema esportivo moderno, limpo, de alta performance visual, utilizando cores primárias em tons de verde gramado, azul escuro de navegação e acentos vibrantes.

- Estados de UI obrigatórios para todas as telas: Idle, Loading (com skeletons nativos), Success, Error (com mensagens amigáveis) e Empty States ilustrados.

- Zero avatares genéricos: perfis utilizam fotos reais, nome completo e apelido de quadra em evidência.

---

### 3. ARQUITETURA DE TELAS E ROTAS

Implemente as seguintes rotas protegidas e públicas utilizando React Router:

1. /auth (Pública): Telas unificadas de Login e Cadastro (com foto de perfil, nome e apelido).

2. /map ou / (Privada): Tela principal contendo o Mapa GPS interativo em tempo real, listagem de pins de quadras com partidas ativas, barra de pesquisa rápida e botão flutuante para "Criar Partida". Ao clicar em uma partida, abre-se uma "Súmula Digital" em formato de gaveta (drawer) inferior mostrando a lista detalhada de participantes dividida entre Jogadores e Telespectadores.

3. /matches/new (Privada): Tela/Modal de criação de nova partida, seleção de quadra no mapa, tipo de evento (Pelada ou Campeonato) e início do ciclo.

4. /teams (Privada): Hub de Times da região. Permite ver clãs, solicitar entrada, criar um novo time (com escudo e nome) e gerenciar convites.

5. /teams/confrontos (Privada): Tela de agendamento e histórico de "Contra" (confrontos entre times), com interface de submissão e validação cruzada de placar por ambos os capitães.

6. /ranking (Privada): Aba de Leaderboards (Gran Turismo style) com filtros por Local, Estado e Global, exibindo as maiores notas e estatísticas de atletas para visualização geral e de olheiros.

7. /profile (Privada): Carteira do Boleiro, exibindo foto real, apelido, nota média estrelas atual (ex: 4.9 ⭐), histórico de partidas jogadas, times vinculados e selos/elogios recebidos.

---

### 4. BANCO DE DADOS E SUPABASE (SCHEMA E SEGURANÇA)

Configure o Supabase com as seguintes tabelas, tipos, chaves estrangeiras e índices otimizados:

- profiles: id (uuid, PK, ref auth.users), full_name, nickname, avatar_url, city, state, created_at, updated_at.

- venues: id (uuid, PK), name, address, latitude, longitude, description, photo_url, created_at.

- matches: id (uuid, PK), venue_id (FK venues), created_by (FK profiles), status ('active', 'finished', 'cancelled'), match_type ('pelada', 'campeonato'), score_team_a (int, default 0), score_team_b (int, default 0), created_at, updated_at.

- match_participants: id (uuid, PK), match_id (FK matches), user_id (FK profiles), role ('player', 'spectator'), team_side ('A', 'B', null), checked_in_gps (boolean), created_at.

- ratings: id (uuid, PK), match_id (FK matches), evaluator_id (FK profiles), evaluated_user_id (FK profiles), score (int 1-5), is_opponent (boolean), created_at. Restrição de unicidade combinada para garantir um voto por usuário avaliador por usuário avaliado na mesma partida.

- teams: id (uuid, PK), name, shield_url, captain_id (FK profiles), city, state, created_at.

- team_members: id (uuid, PK), team_id (FK teams), user_id (FK profiles), status ('invited', 'pending_approval', 'active'), created_at.

- match_confrontos: id (uuid, PK), venue_id (FK venues), team_a_id (FK teams), team_b_id (FK teams), reported_score_a_by_a (int), reported_score_b_by_a (int), reported_score_a_by_b (int), reported_score_b_by_b (int), status ('pending', 'confirmed', 'conflict_nullified'), created_at, updated_at.

#### Políticas de Segurança RLS (Row Level Security):

- Habilite RLS em TODAS as tabelas.

- Garanta que usuários só possam alterar seus próprios perfis, criar partidas onde são o created_by, submeter avaliações onde são o evaluator_id e onde o GPS/participação na partida seja válido.

- Proíba vazamento de credenciais ou exposição de chaves privadas no frontend. Use variáveis de ambiente padrão do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).

---

### 5. REGRAS DE NEGÓCIO TÉCNICAS

1. *Ciclo de Partida:* Apenas o usuário criador da partida (created_by) possui permissão para mudar o status de active para finished.

2. *Validação de Voto:* O botão de avaliação (1 a 5 estrelas) só é habilitado se o participante possuir registro de presença (checked_in_gps = true) na partida e o status dela for finished. O voto é estritamente único por par (avaliador, avaliado, partida).

3. *Confronto de Times e Anti-Conflito:* 

   - O Capitão do Time A submete o placar final do "Contra".

   - O Capitão do Time B entra na aba e confirma ou altera o placar.

   - Se reported_score de ambos coincidirem, o status vira confirmed e os pontos alimentam o ranking.

   - Se houver divergência irredutível e a súmula dos telespectadores não validar, o sistema define o status como conflict_nullified (partida anulada automaticamente para evitar brigas).

---

### 6. PWA E CONFIGURAÇÕES TÉCNICAS

- Crie um manifest.json completo (name, short_name, start_url, display: "standalone", background_color, theme_color, ícones nos tamanhos 192x192 e 512x512).

- Implemente um Service Worker funcional para cache de ativos estáticos e fallback offline para telas principais.

- Suporte total a PWA em dispositivos iOS (meta tags de apple-mobile-web-app) e Android.

Construa a aplicação de ponta a ponta sem omitir componentes, assegurando tipagem estrita com TypeScript e formulários validados com Zod. use esse projeto supabase https://odjgylxayhluepjbiqxi.supabase.co sempre

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://faltasoodominio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/70cefb4d-04c2-48cf-b0b5-afa6ac8b552f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
