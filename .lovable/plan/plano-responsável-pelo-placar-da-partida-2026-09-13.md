# Plano: Responsável pelo placar da partida

Implementar um responsável explícito pelo placar, escolhido pelo criador da partida, sem alterar as demais regras do aplicativo.

## Fluxo

- Na criação da partida, perguntar: “Você será o responsável pelo placar?”
- Se a resposta for “Sim”, o criador já será salvo como responsável.
- Se a resposta for “Não”, a partida será criada sem responsável.
- Depois que outra pessoa entrar na súmula, o criador poderá selecioná-la como responsável pelo placar.
- O criador poderá trocar o responsável enquanto a partida estiver ativa.
- Somente o responsável atual poderá usar os botões de adicionar/remover gols.
- O criador continuará podendo encerrar ou cancelar a partida.
- A súmula mostrará claramente quem é o responsável pelo placar.

## Segurança e dados

- Adicionar à partida um campo opcional que referencia a conta do responsável pelo placar.
- Atualizar as regras de acesso para permitir mudanças de placar somente pelo responsável e permitir que somente o criador atribua o responsável.
- Validar no aplicativo que o responsável escolhido já participa daquela partida.
- Manter compatibilidade com partidas antigas, que continuarão sem responsável até o criador definir um.

## Alterações no aplicativo

- Atualizar os tipos e as funções de criação, atribuição e atualização do placar.
- Adicionar a escolha inicial na tela “Nova partida”.
- Adicionar o seletor de responsável na súmula, visível apenas ao criador e preenchido com participantes reais.
- Exibir os controles de placar apenas ao responsável definido, com mensagens claras quando ainda não houver responsável.
- Invalidar e atualizar os dados da partida após cada atribuição ou gol.

## Migração

- Criar um arquivo SQL idempotente com a nova coluna, índice, permissões e políticas necessárias para o Supabase externo já utilizado pelo projeto.
- Não executar alterações diretamente no banco externo; o arquivo ficará pronto para ser aplicado no painel do projeto.

## Validação

- Verificar criação com “Sim” e “Não”.
- Verificar atribuição e troca do responsável entre participantes.
- Verificar que usuários não autorizados não alteram o placar.
- Verificar atualização dos gols e permanência do placar após recarregar.
