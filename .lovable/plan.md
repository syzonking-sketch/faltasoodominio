# Contra com juiz, súmula e integração ao Radar

## Objetivo
Transformar cada Contra em uma partida completa do aplicativo: com juiz escolhido entre usuários cadastrados, placar e eventos controlados apenas por ele, histórico detalhado ao final e presença automática em Partidas e no Radar quando estiver próximo.

## Implementação

### 1. Um Contra também será uma Partida
- Ao marcar um Contra, criar de forma atômica o registro em `matches` e vinculá-lo em `match_confrontos` por `match_id`.
- Usar a quadra, data/hora, duração padrão de 60 minutos, nomes dos dois times e tipo campeonato.
- Adicionar os membros ativos dos dois times à súmula nos lados A e B, sem duplicar usuários.
- Com isso, o Contra passa a usar automaticamente o fluxo já existente de Partidas, encerramento por tempo, filtro regional, cards e pins do Radar.

### 2. Escolha do juiz
- Incluir busca por nome/apelido entre todos os usuários cadastrados no formulário “Marcar contra”.
- Tornar a escolha do juiz obrigatória e impedir que o Contra seja criado sem quadra.
- Exibir o juiz na lista e nos detalhes do Contra.
- Somente o juiz poderá registrar gols, cartões e encerrar o Contra.

### 3. Gols, cartões e placar
- Criar uma tabela segura de eventos da partida para guardar gol, cartão amarelo e cartão vermelho, jogador, time, minuto e autor do registro.
- O juiz escolherá o jogador do elenco e registrará o evento.
- Gols atualizarão o placar da partida; remoções corrigirão o placar sem permitir valores negativos.
- Cartões permanecerão associados ao jogador e aparecerão na súmula.

### 4. Final do jogo e detalhes
- Tornar os cards de Contra clicáveis e abrir os detalhes completos.
- Mostrar placar final, juiz, quadra, horário, autores dos gols e cartões amarelos/vermelhos.
- Durante o jogo, mostrar ao juiz os controles de evento e encerramento; aos demais, somente acompanhamento.
- Depois do encerramento, manter a súmula disponível em Contras e em Partidas.

### 5. Segurança e banco externo
- Criar um script SQL idempotente para o projeto externo com novas colunas, tabela, índices, permissões, RLS e funções seguras.
- Validar no banco que somente o capitão cria o Contra e somente o juiz altera seus eventos, placar e encerramento.
- Manter leitura pública das partidas e perfis já usada pelo aplicativo.

## Validação
- Verificar criação de Contra com juiz, quadra e horário.
- Confirmar aparição imediata em Contras, Partidas e no Radar próximo à quadra.
- Testar gol e cartões como juiz, bloqueio para outros usuários, encerramento e consulta da súmula final.
- Conferir a experiência em tela de celular e executar a checagem de tipos.

## Observação
O aplicativo e o script serão preparados aqui. Como o projeto usa um banco externo, o script SQL precisará ser executado no painel desse projeto para ativar as novas regras e tabelas.
