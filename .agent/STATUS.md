# Status

Atualizado em: 2026-08-17

## Estado atual

- Current wave: Wave 1 do Plano Mestre — runtime local entregue; agente/contexto em andamento.
- Current checkpoint: checkpoint/wave-10 (workspace.write aprovado).
- Current branch: codex/wip-waves-04-10-20260813.
- Wave 0 checkpoint head: 8bab9fe2e0afcb4be9b28449ccdf31397323778d.
- Repositório operacional: D:\CODEX\Tupiniquim-AI-Dev-Studio.
- Dados: D:\CODEX\Tupiniquim-AI-Dev-Studio.data.
- Toolchain: D:\CODEX\programas.

## Concluído na Wave 0

- Migração operacional F: → D: com ADR 0011, scripts D:, validação de localização e reparo do iniciador corrompido.
- Correção do início Electron ESM por fileURLToPath; a janela real abre no E2E.
- CodexAppServerAdapter com handshake, autenticação degradável sem segredo, JSONL controlado, streaming, interrupção, encerramento e thread/resume.
- Persistência SQLite de threads, turns (somente hash da entrada) e eventos normalizados.
- PolicyEngine aplicado no registrador IPC; comandos absolutamente bloqueados e operações que exigem aprovação são recusados antes do adapter.
- Respostas IPC são verificadas como dados serializáveis antes de cruzar o preload.
- Encerramento de ConPTY aguarda a saída do processo, eliminando a corrida de limpeza.

## Gates atuais

    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-d.ps1 validate
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pnpm-d.ps1 test:e2e

- validate: PASS — validação D:, lint, typecheck, 17 unitários, 13 integrações (2 opt-in ignorados), 4 testes de segurança e build.
- test:e2e: PASS — Electron real, bridge preload, sandbox, política de escrita, bloqueio de git reset --hard, Ollama local, contexto, baseline, manifesto aprovado e workspace.write atômico.

## Concluído na Wave 1

- Adicionado OllamaAdapter local-first: somente HTTP loopback, discovery de /api/tags, seleção explícita de modelo, chat NDJSON, cancelamento e estados NOT_INSTALLED/ERROR explícitos.
- Ollama não está instalado nesta máquina; o produto informa isso sem instalar runtime, modelos, downloads ou serviços pagos.
- O provider é selecionável pelo renderer por IPC tipado e preload mínimo; o painel mostra modelos locais e desabilita envio até existir seleção válida.
- Threads e turns do provider local usam a mesma persistência normalizada; a entrada fica somente como SHA-256 e eventos/modelo são redigidos antes de publicação ou reuso de contexto.
- Contexto do workspace é um catálogo real, limitado e metadata-only (máximo de 256 entradas); ignora itens ocultos e diretórios de build/dependências, não lê conteúdo e trata nomes como dados não confiáveis.
- Ao iniciar uma execução com aprovações válidas, a aplicação coleta e persiste evidências reais e não mutáveis do catálogo do workspace e do status Git; a UI as apresenta no fluxo do plano.
- GitAdapter configura safe.directory somente no processo Git do workspace atual, sem alterar configurações globais.
- Histórico de thread, turns e eventos é recuperável por IPC tipado e aparece na Caixa-preta com contagens e estados; a UI não reexibe entrada bruta.
- Migração SQLite v4 corrige de forma idempotente bancos v3 que não possuíam tabelas de IA, sem remoção de dados.
- Cada passo mutável agora exige um manifesto tipado e sem payload bruto (capacidade, operação, alvo, risco e hash). A aprovação é vinculada ao hash canônico do manifesto, e qualquer mudança de alvo ou efeito torna a decisão anterior inválida.
- A atualização de plano não pode alterar a estrutura, reduzir risco, remover exigência de aprovação, mudar estado de passo ou alterar manifestos após o início da execução. A UI exibe alvo, operação e prefixo do hash antes de habilitar os botões de decisão.
- A primeira ação mutável real é `workspace.write` por um canal de execução próprio. Ela reserva um efeito aprovado uma única vez, confere capacidade/operação, alvo exato e SHA-256 do conteúdo, reavalia a PolicyEngine, usa a escrita atômica do adapter e registra somente alvo redigido e prefixo do hash no AuditLog/Flight Recorder.
- O executor recusa `.env*`, `DELETE`, terminal e Git mutável; uma falha de alvo/hash libera a reserva sem escrever, e um efeito concluído não pode ser repetido.

## Próximo

Permitir que o runtime proponha manifestos de escrita revisáveis sem persistir o payload bruto, mantendo a decisão humana e o canal executável limitado já entregues. Terminal e Git mutável permanecem indisponíveis.

## Bloqueios externos

- OPENAI_API_NO_CREDITS bloqueia somente inferência live paga; não invalida o transporte controlado.
- Provedores visuais pagos permanecem NOT_CONFIGURED.
