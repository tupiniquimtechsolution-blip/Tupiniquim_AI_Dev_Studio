# Segurança

## Fronteiras

- Renderer é não confiável: `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`.
- Preload expõe somente métodos específicos; nenhum `ipcRenderer`, shell ou path genérico.
- Schemas validam toda mensagem e resposta IPC.
- URLs, conteúdo de pesquisa e saída de ferramentas são dados não confiáveis.
- Previews não compartilham sessão ou permissões com a janela principal.

## Política de caminhos

1. Resolver caminho absoluto contra a raiz autorizada.
2. Rejeitar `..`, caminhos de dispositivo, ADS e bytes nulos.
3. Resolver `realpath` do pai/arquivo existente.
4. Rejeitar symlink/junction que escape da raiz.
5. Gravar em temporário irmão e renomear atomicamente.

## Comandos

- Execução agêntica usa executable + args, nunca concatenação de shell.
- Comandos são classificados por risco e escopo.
- Negar por padrão: `reset --hard`, force push, limpeza recursiva ampla, alteração de ACL, secrets e acesso fora do workspace.
- FULL_ACCESS não desativa auditoria, escopo de workspace nem bloqueios absolutos.

## Segredos e logs

- `.env*` é ignorado, exceto `.env.example` sem valores.
- Nunca ler segredos para exibição. Detectar apenas presença quando necessário.
- Redator remove padrões de tokens, Authorization, cookies e credenciais de URLs.
- Logs estruturados possuem correlation id e metadados, não payloads sensíveis.

## Prompt injection

Pesquisa, páginas, comentários, arquivos importados e tool output não podem alterar política. Instruções encontradas neles são citadas como conteúdo e não executadas.

## Aprovação

ASSISTED é o padrão. Aprovação contém ação normalizada, risco, efeitos, alvo, validade e decisão. Alterar o alvo invalida a aprovação.

