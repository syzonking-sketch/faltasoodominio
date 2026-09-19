# Redesign premium da tela Ranking

## Objetivo
Redesenhar exclusivamente a tela **Ranking** com a mesma linguagem visual escura, verde e premium de Radar, Partidas, Times e Perfil, preservando navegação, autenticação, banco e regras existentes.

## O que será construído
- Cabeçalho próprio com título, frase curta, avatar real e controle visual de notificações.
- Controle em cápsula para alternar entre **Jogadores** e **Times**.
- Manutenção do recorte real já disponível para jogadores: **Bairro**, **Estado** e **Global**. Não serão criados filtros de semana/mês porque o ranking atual não fornece períodos confiáveis.
- Pódio visual mobile-first para os três primeiros jogadores, com maior destaque para o líder, avatar, posição, nota média e partidas reais.
- Lista em cards para as demais posições, sem tabela tradicional.
- Card “Sua posição” quando o usuário autenticado estiver fora da parte visível, usando apenas a posição real retornada pelo ranking.
- Estados proporcionais de carregamento, erro, vazio e usuário sem posição.
- Aba **Times** preparada na mesma composição visual. Como o projeto não possui pontuação oficial de equipes, ela não inventará pontos nem fórmula: mostrará um estado claro até existir uma classificação real suportada.

## Dados e regras preservados
- A classificação de jogadores continuará usando a regra já existente em `player_rankings`: ordenação por **nota média**, com quantidade de avaliações e partidas disputadas.
- Não serão exibidos gols, vitórias, assistências, aproveitamento ou “pontos” quando esses valores não fizerem parte da fonte real do ranking.
- Nenhuma consulta, tabela, política, rota, regra de negócio ou tela fora de Ranking será alterada.

## Detalhes técnicos
- Alterar somente `src/routes/_authenticated/ranking.tsx`.
- Reutilizar `fetchRanking`, `useAuth`, `PlayerAvatar`, `Button` e os tokens visuais existentes.
- Manter o item **RANKING** ativo pela navegação atual do aplicativo.
- Atualizar os metadados próprios da rota e validar o resultado em tela pequena e desktop, além dos diagnósticos do projeto.
