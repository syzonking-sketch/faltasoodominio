# Redesign da tela Times

## Objetivo
Transformar somente `/teams` em uma central premium de futebol, seguindo a mesma linguagem escura, verde e imersiva já usada no Radar e em Partidas, sem alterar navegação, autenticação, banco ou regras atuais.

## O que será construído
- Cabeçalho compacto com identidade The Match e ações existentes para `Contras` e `Criar time`.
- Card principal grande e flutuante para o time mais relevante do usuário: primeiro um time que ele capitaneia, depois um time em que seja membro ativo.
- Imagem real quando disponível nos dados exibidos; fallback visual de futebol quando não houver. O escudo real permanecerá em forte destaque.
- Informações reais no card: nome, local, elenco ativo e papel do usuário. Métricas e próxima partida aparecem apenas quando puderem ser derivadas dos confrontos reais.
- Bloco de próxima partida com adversário, data, hora e local reais; estado explícito quando não houver jogo marcado.
- Área “Meus Times” com os demais times em que o usuário é capitão, membro ativo ou aguarda aprovação.
- Área de desempenho com apenas métricas sustentadas pelos confrontos existentes, sem valores inventados.
- Área “Descobrir Times” com os outros times reais e as ações atuais de solicitar entrada.
- Estado de usuário sem time com convite para encontrar ou criar um time.
- Skeleton de carregamento, erro com nova tentativa e estados vazios completos.
- Manutenção integral dos detalhes do time, elenco, solicitações, perfil rápido de jogadores e exclusão de time.

## Dados e regras preservados
- Reutilizar `fetchTeams`, `fetchConfrontos` e os relacionamentos existentes de times, membros, perfis, partidas e locais.
- Reutilizar sem alterações `createTeam`, `requestToJoinTeam`, `setMemberStatus`, `removeMember` e `deleteTeam`.
- Não criar estatísticas que o banco atual não oferece.
- Não criar migração nem modificar políticas de acesso.

## Direção visual
- Aplicar o mesmo fundo `radar-immersive`, tokens semânticos, tipografia e verde já existentes.
- Usar composição imersiva inspirada na referência enviada: imagem dominante, sobreposição, vidro sutil, cantos amplos e conteúdo editorial forte.
- Manter a navegação inferior atual intacta e respeitar a área segura no celular.

## Verificação
- Confirmar carregamento, erro, nenhum time, time principal, outros times, descoberta e solicitações.
- Validar a abertura dos detalhes, aprovação/recusa, entrada, criação e exclusão sem mudar a lógica.
- Revisar visualmente em celular e desktop, garantindo ausência de sobreposição e overflow.
