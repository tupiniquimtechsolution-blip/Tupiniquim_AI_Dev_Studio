# MW3 Engineering Playbook Source

## Fonte avaliada

- Repositório: `soumatheusgomes/vibe-coding-toolkit`
- Ref auditada: `13add21194467dfd2fc5b408ddb3398d306a4c78`
- Papel no Tupiniquim: `ENGINEERING_PLAYBOOK_SOURCE`
- Autoridade: **não autoritativa**
- Runtime dependency: **não**
- Instalação automática de plugins/hooks/binários: **proibida**

O README da fonte apresenta um fluxo de brainstorm → plano → ondas/subagentes → review → ship e destaca quality gates. Também propõe opcionalmente uma regra de 350 linhas por arquivo. A MW3 adota somente princípios compatíveis com a arquitetura real do Tupiniquim.

## Práticas adotadas

1. intenção/brainstorm antes de implementação quando o escopo for ambíguo;
2. plano explícito antes de mudança de código relevante;
3. trabalho em waves/slices com ownership claro para evitar colisão;
4. review antes de promoção;
5. lint/typecheck/test/security/dogfood/build como gates contínuos;
6. registrar aprendizados e handoff ao fechar a wave.

## Práticas não adotadas automaticamente

- teto global de 350 linhas por arquivo;
- instalação de Superpowers/Claude plugins;
- hooks de terceiros;
- CLIs/binários externos;
- memória externa/Obsidian;
- qualquer regra que substitua `AGENTS.md`, `MASTER_PLAN.md`, PolicyEngine ou GitHub Actions.

O limite de tamanho pode ser usado como sinal de refatoração em review, nunca como requisito rígido sem análise de responsabilidade/cohesão.

## Regra de precedência

`Git/código/testes > AGENTS.md/MASTER_PLAN/ADRs > gates do projeto > playbook externo`.

A existência desta fonte não concede capability, permissão, aprovação nem execução a nenhum agente.