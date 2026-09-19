# The Match como app móvel instalável e responsivo

## Objetivo
Fazer o The Match se comportar como um aplicativo instalado no celular e se ajustar bem a telas pequenas, grandes, com notch e diferentes áreas seguras, sem alterar funcionalidades.

## Implementação
- Completar a configuração de instalação com identidade, ícones, tela independente, cores do aplicativo e comportamento adequado em celular.
- Ajustar a base visual para ocupar corretamente a altura disponível, respeitar notch e barra inferior, evitar rolagem horizontal e impedir zoom automático em campos no iPhone.
- Tornar a navegação inferior adaptável a celulares estreitos, mantendo os cinco destinos, o item ativo em cápsula e áreas de toque confortáveis.
- Corrigir cabeçalhos e elementos fixos para não comprimirem nomes ou controles em telas menores.
- Validar as telas principais em larguras pequenas e maiores, incluindo Radar, Partidas, Times, Ranking, Perfil e acesso.

## Detalhes técnicos
- A instalação será feita pelo manifesto já existente, sem adicionar cache offline ou serviço em segundo plano.
- A área útil usará unidades dinâmicas de tela e `safe-area-inset-*`.
- O ajuste visual preservará dados, autenticação, rotas e regras atuais.
