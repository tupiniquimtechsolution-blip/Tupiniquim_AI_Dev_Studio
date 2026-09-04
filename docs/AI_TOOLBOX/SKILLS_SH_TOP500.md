# Skills.sh — Top 500 Skill Library

Atualizado em 2026-09-04.

## Decisão

O Tupiniquim manterá duas listas derivadas do skills.sh:

1. **Top 500 All-Time** — catálogo principal de skills mais utilizadas por instalações agregadas.
2. **Top 500 Trending (24h)** — watchlist dinâmica para detectar skills que estão ganhando adoção.

A skill `vercel-labs/skills/find-skills` é **PINNED** e deve estar sempre disponível para descoberta.

O skills.sh informa que o leaderboard é baseado em telemetria agregada de instalações do Skills CLI. O endpoint oficial `GET /api/v1/skills` suporta `view=all-time|trending|hot` e `per_page` de até 500.

## Por que catálogo em vez de instalar 500 skills de uma vez

As 500 skills entram na **Global Skill Library**, mas não são carregadas no contexto de todos os agentes.

Fluxo:

`Global Catalog -> Project Skill Library -> Team Loadout -> Agent Loadout -> Task Activation`

Isso evita:
- contexto inflado;
- dependências desnecessárias;
- skills conflitantes;
- ampliação automática da superfície de ataque;
- permissões excessivas;
- custo e serviços externos ativados sem consentimento.

## Find Skills

Skill canônica:

`vercel-labs/skills/find-skills`

Uso:
- linguagem natural: "encontre uma skill para X";
- quick command: `npx skills find <query>`;
- instalação após aprovação: `npx skills add <owner/repo> --skill <name>`;
- UI futura: botão **Encontrar Skill** no Skill Deck.

`find-skills` deve consultar primeiro o catálogo local Top 500. Se não houver fit suficiente, pode executar busca externa.

## Sincronização

Script: `scripts/sync-skills-sh-top500.ps1`

Exemplos:

```powershell
# Top 500 mais utilizadas
$env:VERCEL_OIDC_TOKEN = "[definido no ambiente; nunca commitar]"
.\scripts\sync-skills-sh-top500.ps1 -View all-time

# Top 500 trending
.\scripts\sync-skills-sh-top500.ps1 -View trending
```

Saídas padrão:
- `docs/AI_TOOLBOX/generated/skills-sh-top500-all-time.json`
- `docs/AI_TOOLBOX/generated/skills-sh-top500-trending.json`

O token não é escrito em disco pelo script.

## Skill Gate

Antes de uma skill ser ativada:

1. localizar metadados e fonte;
2. inspecionar `SKILL.md` e arquivos auxiliares;
3. verificar licença quando aplicável;
4. verificar dependências e serviços externos;
5. verificar auditorias de segurança disponíveis;
6. classificar permissões necessárias;
7. classificar custo: FREE_LOCAL, FREE_ACCOUNT, FREEMIUM, PAID_DEPENDENCY, PAID, UNKNOWN;
8. atribuir compatibilidade por agente/projeto;
9. solicitar aprovação se exigir rede, escrita, shell, credenciais ou serviço pago;
10. registrar versão/hash e provenance.

## Skill Card

Cada skill deve ser representada por:

- `id`;
- `name`;
- `source`;
- `rank`;
- `installs`;
- `sourceType`;
- `installUrl`;
- `skillsUrl`;
- `hash` quando disponível;
- `auditStatus`;
- `risk`;
- `costClass`;
- `permissions`;
- `recommendedAgents`;
- `enabledProjects`;
- `version/ref`;
- `lastSyncedAt`.

## Ativação na interface

O Skill Deck deve permitir:

- **linguagem natural** — "ensine RAG para este agente";
- **Skill Wheel** — categorias visuais;
- **drag & drop** — arrastar a carta para um agente;
- **Quick Palette** — busca por nome/capacidade;
- **Find Skills** — busca inteligente no catálogo e depois no ecossistema;
- **recomendação do Planner** — sugere loadout por tipo de projeto;
- **Guided Tour** — tutorial contextual ao entrar pela primeira vez.

## Atualização e reprodutibilidade

O ranking muda com o tempo. Por isso:

- não codificar os 500 IDs manualmente no core;
- versionar snapshots gerados com timestamp;
- registrar o ranking usado para cada projeto;
- manter `find-skills` pinned;
- revalidar uma skill antes de atualizar para uma versão/hash diferente.

## Segurança

A presença no leaderboard não é aprovação de segurança.

Popularidade é apenas um sinal de adoção. A execução continua subordinada a:
- PolicyEngine;
- project/workspace isolation;
- approval gates;
- AuditLog;
- allowlists;
- redaction;
- princípio de menor privilégio.
