# Operação, Deployment e Suporte

Atualizado em: 2026-09-22

## 1. Ambiente alvo atual

- Sistema primário de homologação: Windows x64.
- Repositório operacional: `F:\CODEX\Tupiniquim-AI-Dev-Studio`.
- Dados operacionais: `F:\CODEX\Tupiniquim-AI-Dev-Studio.data`.
- Branch RC1 atual: `arena/01a0c8ba-tupiniquim-ai-dev-studio`.
- PR de consolidação: #32, DRAFT até aceite.

## 2. Fluxo operacional desejado

O usuário deve ter três ações previsíveis:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-rc1-windows.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-rc1.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-rc1-windows.ps1
```

Na V1 final os nomes podem mudar, mas a experiência deve continuar simples: SETUP → RUN → VERIFY.

## 3. Setup

Responsabilidades: validar arquitetura/paths; preparar Node/pnpm/Git; detectar/instalar Ollama oficialmente; preservar runtimes/modelos existentes; ler manifesto local; pedir autorização para downloads; preparar dependências/build; não copiar credenciais; não apagar modelos.

Downloads precisam ser explícitos e idempotentes. O setup deve informar espaço necessário e preservar o ambiente existente quando não for seguro migrá-lo automaticamente.

## 4. Model storage

Ollama já ativo deve ser reutilizado. Store existente fora de F: não pode ser movido/apagado silenciosamente. Novo runtime controlado deve usar caminhos autorizados. Catálogo da UI deve refletir o runtime real, não lista hardcoded.

## 5. Packaging

A V1 deve gerar artefato Windows reproduzível em diretório conhecido, com main/preload/renderer corretos, assets locais, runtime necessário ao Preview quando adotado e sem dependências de CDN para funções essenciais.

Entregáveis de release: instalador/portable conforme estratégia aprovada, hash do artefato, versão, changelog, known issues e evidence pack.

## 6. Configuração e segredos

- nunca versionar `.env*` com segredos;
- usar fluxo oficial de OAuth/chaves;
- tokens Google fora do renderer;
- Codex auth isolada em CODEX_HOME;
- serviços pagos desabilitados até autorização;
- logs sanitizados.

## 7. Troubleshooting mínimo

Categorias documentadas: ExecutionPolicy PowerShell; Node/pnpm version; Git ausente; Ollama indisponível; modelo inexistente; pouco espaço em F:; Codex AUTH_REQUIRED; Google Tasks NOT_CONFIGURED/AUTH_REQUIRED; Electron/package failure; ConPTY indisponível; SQLite/migration failure; provider-choice corrompido; network blocked.

Cada erro deve ter mensagem acionável, sem escolher fallback silencioso.

## 8. Backup e recovery

Antes de migrations: backup. Recovery deve restaurar dados/sessões sem restaurar authority inválida de approvals antigos. Config files corrompidos falham explicitamente. Evidência de restart/recovery faz parte do gate V1.

## 9. Suporte pós-release

Níveis sugeridos:
- Community: documentação/issues, sem SLA.
- Pro: updates e troubleshooting padrão.
- Team/Business: suporte prioritário, onboarding, policy/model configuration.
- Enterprise: implantação, hardening, SSO/identity quando implementado, SLA, change management e release ring dedicado.

## 10. Telemetria e privacidade

Qualquer telemetria futura deve ser opt-in quando apropriado, minimizada, documentada e separada de conteúdo privado. O produto deve continuar utilizável localmente sem enviar workspace/conversation para analytics externo por padrão.

## 11. Release checklist

HEAD limpo/auditado; versão definida; deps lockadas; validate GREEN; E2E Windows GREEN; smoke manual; providers reais; package/hashes; migration/backup; changelog; known issues; security review; Project Bible; Agenor/Notion/Miro; aprovação de merge/tag/checkpoint.
