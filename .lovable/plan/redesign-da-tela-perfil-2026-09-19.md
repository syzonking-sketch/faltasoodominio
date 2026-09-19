# Redesign da tela Perfil

## Escopo
- Alterar somente a página **Perfil**.
- Preservar autenticação, banco, rotas, navegação inferior e as funções atuais de editar perfil e sair.
- Não alterar Radar, Partidas, Times ou Ranking.

## Estrutura visual
- Usar o mesmo fundo escuro imersivo e os mesmos tokens verdes já adotados em Radar, Partidas e Times.
- Reproduzir a composição da referência: topo amplo com avatar real à esquerda e controle circular de notificações à direita, identidade do jogador, seletor em cápsula, card principal grande, sequência visual de partidas e métricas horizontais.
- Manter proporções mobile-first, áreas de toque confortáveis, safe area e ausência de overflow indevido.

## Dados reais
- Reutilizar `useAuth` para sessão, perfil, nome, apelido, avatar e localização, mantendo os fallbacks atuais vindos dos metadados reais da conta.
- Reutilizar as consultas de partidas existentes e filtrar apenas partidas em que o usuário consta como participante.
- Reutilizar as estatísticas públicas já disponíveis para média de avaliações, quantidade de avaliações, jogos, gols, cartões amarelos e cartões vermelhos.
- Não exibir assistências, vitórias, derrotas ou empates porque esses dados não estão ligados de forma confiável ao jogador no modelo atual.
- Usar `venue.photo_url` como imagem real da partida; quando não existir, usar o visual de futebol já pertencente ao aplicativo, sem inventar informações.

## Meus Jogos
- Criar a aba principal **Meus Jogos** com a participação mais relevante/recente em um card protagonista de imagem grande, overlay, status, data, hora, local, modalidade, jogadores e placar real quando encerrada.
- Exibir as demais participações em cards visuais, sem formato de tabela.
- Permitir abrir os detalhes da partida usando o fluxo já existente.
- Mostrar estado vazio amigável quando ainda não houver partidas vinculadas ao usuário.

## Desempenho
- Criar a aba **Desempenho** com os dados reais do jogador.
- Mostrar somente métricas existentes: Nota média (apenas quando houver avaliações), Jogos, Gols, Cartões amarelos, Cartões vermelhos e quantidade de avaliações.
- Organizar os indicadores em uma faixa horizontal inspirada na referência, usando ícones profissionais já instalados.

## Estados e ações preservadas
- Criar skeletons proporcionais ao novo layout enquanto conta, perfil, partidas ou estatísticas carregam.
- Manter erro com tentativa novamente e mensagem amigável quando o usuário/perfil não for encontrado.
- Reencaixar edição de apelido, cidade e estado no novo visual, sem mudar a mutação existente.
- Manter a saída da conta e destacar Perfil como item ativo pela navegação existente.

## Validação
- Confirmar que a página compila sem erros.
- Verificar visualmente em 393 × 756 e em desktop, incluindo troca de abas, abertura de partida, edição do perfil, vazios e carregamento quando acessíveis.
- Conferir que nenhuma outra página foi modificada.
