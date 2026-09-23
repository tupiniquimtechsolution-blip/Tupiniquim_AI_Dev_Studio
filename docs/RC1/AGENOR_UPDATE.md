# Agenor — RC1 integrada, NÃO APROVADA para aceite V1

Branch fixa da sessão: `arena/01a0c8ba-tupiniquim-ai-dev-studio`.
Bases reconciliadas: `be33b64114def08b4ca18a04310fcdc72b1eca8b` + `eb93c352127d3b6263d1f2abf485ff31b390292a`.
HEAD definitivo: executar `git rev-parse HEAD` na entrega (também informado no relatório final).

## Instalação na máquina autorizada

Pré-condição: checkout desta branch em `F:\CODEX\Tupiniquim-AI-Dev-Studio`, Windows x64 com acesso aos endpoints oficiais e autorização de execução de scripts locais. Não cria/copía login do Codex ou Google.

```powershell
.\scripts\setup-rc1-windows.ps1
```

Autoriza downloads mostrando estimativas. Required apenas por padrão; `-IncludeRecommended` / `-IncludeOptional` são opt-in. `-AcceptDownloads` suprime perguntas de download quando explicitamente autorizado. Node/pnpm/MinGit/Ollama ausentes são instalados em F:. Dependências, modelos e build são preparados. Não apaga modelos.

```powershell
.\scripts\run-rc1.ps1
```

Empacotar: `.\scripts\build-rc1-windows.ps1`. Destino `F:\CODEX\Tupiniquim-AI-Dev-Studio\release\`; portátil e `win-unpacked`. Não há .exe Windows homologado no Arena.

```powershell
.\scripts\verify-rc1-windows.ps1
```

Executa validação F:, lint, typecheck, unit, integration, security, build, E2E, package e inferência real do primeiro modelo instalado (somente smoke, não altera escolha do app). Falha se qualquer gate falhar. Relatório fica em `F:\CODEX\Tupiniquim-AI-Dev-Studio.data\rc1-evidence\<timestamp>\results.json`.

## Teste humano necessário

1. Abrir pasta autorizada; ler arquivo; editar/salvar e aprovar diálogo; ver diff real.
2. Escolher provider/modelo explicitamente. Codex ausente/não autenticado deve bloquear envio; sem login automático. Ollama deve listar também modelos não pertencentes ao manifesto.
3. CHAT e PLAN/proposta/aprovação com modelo compatível; negar efeitos indevidos.
4. Reiniciar e reabrir workspace; conferir sessão, escolha do modelo e provenance, sem restaurar autoridade antiga de propostas.
5. Google Tasks sem configuração deve mostrar NOT_CONFIGURED; com credenciais OAuth desktop próprias, consentir no navegador, listar/criar lista e tarefa. Configuração documentada em `docs/GOOGLE_TASKS_INTEGRATION.md`; nunca colar tokens no renderer/chat.
6. Conferir preferências persistidas e limites explícitos em KNOWN_ISSUES.md. Não assinar RF-01..15 apenas porque testes unitários passaram.

Notion: não atualizado (nenhuma integração disponível nesta sessão).
Miro: não atualizado (nenhuma integração disponível nesta sessão).
