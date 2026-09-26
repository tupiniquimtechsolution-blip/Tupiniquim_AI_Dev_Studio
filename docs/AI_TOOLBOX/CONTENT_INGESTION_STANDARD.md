# Tupiniquim Toolbox — Content Ingestion Standard

Atualizado em: 2026-09-22

## Objetivo

Padronizar como o Tupiniquim recebe, extrai, verifica, classifica e reaproveita conhecimento externo sem perder contexto e sem transformar conteúdo viral em regra automática.

## 1. Tipos de fonte

### Vídeo
Extrair por camadas:
- visual/texto na tela;
- frames relevantes;
- legendas/transcrição quando disponíveis;
- áudio somente quando efetivamente transcrito/entendido;
- links, handles, nomes de repos/tools;
- demonstrações de fluxo;
- claims promocionais separados de evidência.

### Carrossel
Para cada slide:
- número do slide;
- título;
- texto principal;
- técnica/regra;
- ferramenta/repo citado;
- exemplo visual;
- claim ou opinião;
- dependência de contexto.

### Screenshot
- ler apenas elementos legíveis;
- identificar UI, repo, terminal, código ou ferramenta;
- registrar partes ilegíveis como `unknown`;
- não inferir estado oculto.

### Repositório
- confirmar upstream;
- inspecionar README/licença/estrutura/configs relevantes;
- registrar ref/commit quando for candidato a adoção;
- procurar material sensível/credencial-like sem reproduzi-lo;
- classificar capacidade, maturidade e risco.

### Artigo/Post/Paper
- separar tese, evidência, opinião e marketing;
- preservar fonte/data/autor;
- verificar fonte primária quando houver claim técnico importante.

## 2. Método de extração

### Passo A — Evidence First
Produzir primeiro uma lista de fatos diretamente suportados pela fonte.

Formato:
- `EVIDENCE-VISUAL`
- `EVIDENCE-AUDIO`
- `EVIDENCE-TEXT`
- `EVIDENCE-CODE`
- `EVIDENCE-UPSTREAM`

### Passo B — Entity Extraction
Extrair:
- repos;
- tools;
- skills;
- MCPs;
- APIs;
- libraries;
- frameworks;
- models;
- providers;
- commands;
- techniques;
- checklists;
- patterns;
- anti-patterns;
- security risks;
- business/monetization ideas.

### Passo C — Verification Queue
Tudo que precisar de confirmação entra em fila explícita:
- upstream oficial?
- repo ainda ativo?
- licença?
- preço/custo?
- claim reproduzível?
- endpoint oficial?
- comando realmente existe?
- ferramenta exige conta/API/token?
- conteúdo ficou obsoleto?

### Passo D — Operational Translation
Converter conhecimento em uma ou mais formas:
- regra corporativa;
- checklist;
- security gate;
- QA gate;
- design guideline;
- prompt macro;
- skill candidate;
- tool candidate;
- capability source;
- reference library;
- architecture pattern;
- anti-pattern;
- project task;
- research-only item.

Toda tradução deve preservar a diferença entre `MANDATORY`, `RECOMMENDED`, `CONDITIONAL`, `REFERENCE_ONLY`, `DEFERRED` e `REJECTED`.

## 3. Template para vídeo/carrossel

```text
SOURCE
id:
type: video|carousel|screenshot|post|other
author:
platform:
url:
date_seen:

EVIDENCE
- confirmed visually:
- confirmed by text/transcript:
- code/command visible:
- uncertain/illegible:

ENTITIES
- repositories:
- tools:
- skills:
- MCPs/APIs:
- models/providers:

TECHNIQUES
1.
2.

CLAIMS REQUIRING VERIFICATION
1.
2.

RISKS
- security:
- privacy:
- licensing:
- cost:
- vendor lock-in:

OPERATIONAL TRANSLATION
- rule/checklist/pattern:
- degree: MANDATORY|RECOMMENDED|CONDITIONAL|REFERENCE_ONLY|DEFERRED|REJECTED

PROJECT IMPACT
- project:
- applicability:
- proposed task:

ADOPTION DECISION
ADOPT|GUARDED_ADOPTION|REFERENCE_ONLY|DEFER|REJECT

NEXT ACTION
...
```

## 4. Decomposição de conhecimento

Não salvar apenas resumos longos. Criar unidades atômicas reutilizáveis.

Exemplo:

```text
KU-SEC-001
Title: Não expor API key em bundle/frontend
Type: security-rule
Content: Credenciais privilegiadas não podem estar no client bundle.
Normative: MANDATORY
Confidence: confirmed
Source: VIDEO-2026-09-03-RAVANEDA-01
AppliesTo: web, saas, mobile-backend
Relationships: rate-limit, authz, secret-scanning
```

Isso permite RAG, busca, deduplicação e aplicação transversal.

## 5. Deduplicação e conflito

Antes de adicionar conhecimento:

- pesquisar regra/técnica equivalente;
- manter uma unidade canônica e anexar nova fonte como evidência adicional;
- não criar dez regras iguais por existirem dez vídeos iguais;
- quando fontes divergirem, registrar conflito sem escolher silenciosamente;
- marcar informação antiga como `obsolete` apenas com evidência suficiente.

Formato de conflito:

```text
CONFLICT
canonical_unit:
source_a:
claim_a:
source_b:
claim_b:
resolution:
status: unresolved|resolved
```

## 6. Qualificação de repositórios e ferramentas

### Provenance
- upstream canônico;
- fork/mirror;
- maintainer/owner;
- URL;
- commit/ref.

### Licença
- licença identificada;
- compatibilidade com uso pretendido;
- restrições relevantes.

### Manutenção
- atividade recente;
- issues/release cadence quando necessário;
- archived/deprecated?

### Segurança
- secrets;
- scripts de instalação;
- execução privilegiada;
- network/egress;
- coleta de dados;
- dependências;
- auth/session handling.

### Operação
- local/cloud;
- hardware;
- custo;
- credenciais;
- setup;
- portabilidade;
- lock-in.

### Fit
- capacidade nova ou duplicada?;
- qual agente/tool/skill consumiria?;
- qual wave permite?;
- qual projeto se beneficia?;

## 7. Knowledge Pack

Cada lote de ingestão deve gerar um pack versionado contendo:

- metadata;
- sources;
- entities;
- knowledge_units;
- repository_candidates;
- tool_candidates;
- skill_candidates;
- security_findings;
- checklists;
- patterns;
- project_impacts;
- adoption_decisions;
- rejected_items;
- deferred_items;
- conflicts;
- obsolete_information;
- agenor_updates.

Nunca incluir secrets, cookies, tokens, sessões ou `.env` real.

## 8. Aplicação transversal

O valor do Toolbox é reutilizar conhecimento sem contaminar todos os projetos automaticamente.

Para cada Knowledge Unit, registrar tags de escopo:

- `global` — potencialmente útil para todos;
- `web`;
- `saas`;
- `desktop`;
- `mobile`;
- `ecommerce`;
- `landing-page`;
- `crm`;
- `health`;
- `media`;
- `game`;
- `local-ai`;
- `marketing`;
- `devops`;
- outras específicas.

Depois mapear quais projetos reais devem receber task de adoção. A criação da task é preferível a uma alteração silenciosa.

## 9. Frequência e manutenção

### A cada conteúdo recebido
- extrair;
- verificar o necessário;
- classificar;
- deduplicar;
- gerar Knowledge Units;
- mapear impacto.

### A cada lote relevante
- atualizar catálogos;
- produzir Knowledge Pack;
- sincronizar Agenor;
- registrar changelog.

### Periodicamente
Revalidar itens `ADOPT`/`GUARDED_ADOPTION` por:
- upstream;
- licença;
- segurança;
- manutenção;
- custo;
- compatibilidade.

## 10. Saída para o usuário

A resposta humana deve ser curta o suficiente para decisão, mas o registro canônico deve ser completo.

Formato recomendado da resposta:

1. **O que foi extraído** — fatos.
2. **O que foi verificado** — upstream/fonte.
3. **O que vale para o Toolbox** — regras, técnicas e candidates.
4. **Onde pode ajudar** — projetos impactados.
5. **O que não foi adotado** — incertezas/riscos.
6. **O que foi salvo/atualizado** — arquivos/tasks.
