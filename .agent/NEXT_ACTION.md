# Próxima ação

1. Criar uma proposta de manifesto de `workspace.write` produzida pelo runtime, contendo somente metadados persistíveis e payload mantido em memória até a decisão humana; qualquer conteúdo do workspace segue não confiável.
2. Permitir revisão explícita de alvo, operação, risco e hash no painel antes da aprovação, sem expor nem registrar o conteúdo proposto fora da execução efetiva.
3. Vincular a proposta ao thread/turn de origem e invalidá-la em caso de nova proposta, troca de workspace, mudança de alvo ou reinício do aplicativo.
4. Cobrir propostas ausentes/obsoletas, conteúdo divergente, `.env*` e persistência sem payload; então executar gates e checkpoint antes de ampliar terminal ou Git.
