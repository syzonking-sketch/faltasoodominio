# Corrigir gestão de times

## O que será feito
- Tornar cada cartão de time clicável e abrir uma visão completa com capitão, localização, elenco e pedidos pendentes.
- Permitir que somente o capitão exclua o time, com confirmação antes da remoção.
- Corrigir aprovação e recusa para validar que a alteração realmente aconteceu antes de mostrar sucesso.
- Atualizar imediatamente o elenco e a lista de solicitações após aceitar ou recusar, sem manter dados antigos na tela.
- Desabilitar as ações durante o processamento para impedir cliques duplicados.

## Segurança e dados
- Adicionar uma função segura para excluir o time somente quando o usuário autenticado for o capitão.
- Adicionar funções seguras para aceitar ou recusar solicitações, verificando no banco se o usuário é o capitão daquele time.
- Manter a leitura atual dos times e perfis públicos, sem ampliar acesso a dados pessoais.
- Entregar um script SQL idempotente para aplicar no projeto externo, sem executá-lo automaticamente.

## Detalhes técnicos
- Reaproveitar a página atual de Times e abrir os detalhes em um painel móvel responsivo.
- Fazer as mutações retornarem erro quando nenhuma linha for alterada, evitando mensagens falsas de sucesso causadas por RLS.
- Atualizar o cache local de Times e depois confirmar os dados com uma nova consulta.
- Validar tipos e o fluxo visível após as mudanças.
