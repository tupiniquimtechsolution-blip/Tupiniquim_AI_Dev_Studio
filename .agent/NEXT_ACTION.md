# Próxima ação

1. Adicionar consumo da proposta efêmera ao executor de `workspace.write`, transferindo o payload somente no processo principal após o manifesto ser aprovado; o renderer envia apenas o id da proposta.
2. Conferir novamente thread/turn, workspace, efeito e hash durante o consumo; proposta ausente, obsoleta ou reiniciada retorna estado explícito sem escrita.
3. Refletir no painel que o manifesto veio de uma proposta vinculada ao turn, sem exibir conteúdo nem liberar terminal ou Git.
4. Cobrir consumo aprovado, ausência, substituição, workspace divergente e payload nunca persistido; então executar gates e checkpoint.
