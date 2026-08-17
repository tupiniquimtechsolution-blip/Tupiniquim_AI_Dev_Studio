# Próxima ação

1. Implementar somente `workspace.write` para uma ação de execução que tenha manifesto aprovado: alvo relativo validado, conteúdo cujo SHA-256 corresponda ao `payloadHash`, escrita atômica no adapter e ausência explícita de qualquer outra capacidade.
2. Reavaliar o intent com PolicyEngine e registrar no AuditLog o resultado, sem permitir que a aprovação do plano contorne bloqueios absolutos ou o escopo do workspace.
3. Expor a ação por IPC/preload mínimos e apresentar no Flight Recorder somente evidência redigida (capacidade, alvo e hash), nunca o conteúdo.
4. Cobrir sucesso, hash divergente, alvo divergente, decisão inválida e tentativa de terminal/Git; então executar gates e checkpoint antes de memória semântica ou browser controlado.
