# ADR 0013 — Tool calling local para propostas privilegiadas

Status: Aceito

Propostas automáticas de `workspace.write` usam inicialmente o tool calling oficial do endpoint local `/api/chat` do Ollama, sempre por HTTP em loopback. O Codex App Server permanece na API estável, com `experimentalApi=false`, sandbox read-only, approval policy `never` e requests não allowlisted negados.

A única ferramenta desta etapa é `tupiniquim_workspace_write_proposal`. O modelo fornece apenas `relativePath`, `content` e `operation` (`CREATE` ou `REPLACE`). `executionId` e `stepId` vêm do contexto privilegiado vinculado ao envio; provider, Thread e Turn vêm do adapter; capability, risco, manifesto e hash são derivados pelo core. O modelo não pode declarar sua própria proveniência, autorização, workspace ou risco.

O conteúdo bruto pode existir somente no runtime local Ollama durante a inferência e na memória efêmera do processo principal enquanto a proposta estiver disponível. Ele nunca cruza preload/renderer, não entra em SQLite, AuditLog, Flight Recorder ou AIEvent e não é devolvido pela resposta pública. O renderer recebe por evento dedicado apenas IDs, proveniência, alvo, operação, risco, timestamp e SHA-256.

O primeiro incremento permite uma única chamada de ferramenta e uma única proposta de arquivo por Turn/passo. Tool desconhecida, chamada múltipla, contexto divergente, `.env*`, alvo fora do workspace ou payload inválido falham de forma fechada. Terminal, Git mutável, `DELETE` e aprovação automática permanecem indisponíveis.
