# Tupiniquim Dev AI — AI Lab USB + Toolbox Integration

## Status

Branch: `integration/ai-lab-toolbox-unified`
Base imutável inicial: `022ba49128a92c9f6616451ad447a07b0fa04e16`

Esta trilha unifica o Tupiniquim AI Dev Studio, o AI Lab USB e o Tupiniquim Toolbox em um único produto, sem substituir a arquitetura segura já comprovada do Studio e sem marcar capacidades locais como disponíveis quando o runtime/hardware não existir.

## Produto resultante

O **Tupiniquim Dev AI** passa a ser a aplicação principal e contém três camadas integradas:

1. **Studio** — workspace, editor, terminal, agentes, projetos, sessões, planejamento, revisão, pesquisa, visual e automação.
2. **AI Lab Runtime** — execução local/portátil, Ollama, modelos locais, ferramentas instaláveis e infraestrutura `runtime/`, `models/`, `data/`, `projects/`, `cache/`.
3. **Toolbox** — catálogo de skills, boas práticas, segurança, qualidade, auditoria, conhecimento e ferramentas ativáveis explicitamente pelo usuário.

## Princípios obrigatórios

- Seleção de provider/modelo permanece explícita; nenhum fallback automático.
- Skills não são executadas apenas porque foram descobertas. Descoberta != aprovação != habilitação != execução.
- Toda capacidade mutável ou privilegiada continua passando por PolicyEngine/ApprovalStore/AuditLog quando aplicável.
- A camada AI Lab deve ser portátil e detectar sua raiz em runtime; `F:\CODEX` continua válido como contrato de certificação Windows existente, mas a arquitetura integrada deve suportar mídia removível e diretórios equivalentes sem gravar fora do root autorizado.
- Modelos e runtimes locais nunca são baixados, alterados ou removidos silenciosamente.
- O sistema deve funcionar em modo degradado seguro quando um runtime local não estiver disponível.
- O repositório GitHub continua sendo a fonte de verdade do produto. Dados pesados, modelos e caches não entram no Git.

## Menu unificado do usuário

O produto deve expor uma central única denominada **Tupiniquim Control Center** com grupos:

### Modelos & Providers

- Ollama local
- Codex App Server
- seleção explícita de modelo local
- status do runtime/modelo
- instalar/importar modelo somente mediante ação explícita
- perfis de hardware e recomendações informativas, nunca troca automática

### Skills

- listar skills descobertas
- pesquisar skills
- revisar origem/licença/dependências/permissões/custo
- habilitar/desabilitar por projeto
- fixar skills aprovadas
- bloquear skill não auditada quando exigir capacidade privilegiada

### Toolbox

- boas práticas de engenharia
- lint/typecheck/test/build
- auditoria de dependências
- secret scan
- segurança web/app
- LGPD/privacidade
- WCAG/acessibilidade
- revisão de arquitetura
- análise de performance
- auditoria de supply chain
- checklist de release

Cada ação deve mostrar previamente: escopo, comandos/capacidades, arquivos afetáveis, necessidade de rede, permissões e nível de risco.

### AI Lab

- detectar runtimes instalados
- iniciar/parar Ollama
- listar modelos locais
- validar armazenamento portátil
- health checks
- gerenciar ferramentas opcionais do laboratório
- abrir interfaces auxiliares suportadas
- mostrar espaço em disco e dependências

### Agentes

- Agent Registry
- associação Agent -> Provider/Model
- associação Agent -> Skills
- associação Agent -> Project/Thread
- loadouts de skills por projeto
- permissões por agente

### Segurança & Qualidade

- executar gates sob demanda
- mostrar PASS/FAIL/SKIPPED/NOT_AVAILABLE com evidência
- nunca converter ausência de ambiente em PASS
- exportar relatório de evidência

## Capacidades do AI Lab a preservar

- execução local-first e offline quando a capacidade não exige rede
- Ollama como runtime local
- múltiplos modelos disponíveis para escolha manual
- Native Agent/tool-calling real já comprovado no AI Lab com modelo Qwen local
- Kimi como opção experimental/heavy, sem prioridade automática
- capacidades de mídia via Open Generative AI/MiniMax quando tecnicamente disponíveis
- isolamento de `runtime`, `models`, `data`, `projects` e `cache`

## Capacidades do Toolbox a preservar

- Skill Registry e descoberta separadas de aprovação
- `find-skills` pinado
- default deny para capacidades privilegiadas
- validação de schema
- auditoria de dependências e supply chain
- secret scan
- LGPD/WCAG
- rollback e evidências
- segurança web/app
- rastreabilidade de origem/proveniência

## Arquitetura proposta

```text
Tupiniquim Dev AI
├── Control Center
│   ├── Models & Providers
│   ├── Skills
│   ├── Toolbox
│   ├── AI Lab
│   ├── Agents
│   └── Security & Quality
├── Runtime Layer
│   ├── Provider Registry
│   ├── Model Registry
│   ├── Portable Runtime Registry
│   └── Capability Health
├── Skill Layer
│   ├── Discovery
│   ├── Audit
│   ├── Approval
│   └── Project Enablement
├── Policy Layer
│   ├── PolicyEngine
│   ├── ApprovalStore
│   └── AuditLog
└── Execution Layer
    ├── Workspace
    ├── Terminal/ConPTY
    ├── Agent Runtime
    ├── Ollama
    └── External tools
```

## Migração do AI Lab USB

Não haverá importação de binários/modelos pesados para o GitHub. O processo correto é:

1. definir manifesto portátil versionado;
2. registrar runtimes e ferramentas por ID estável;
3. detectar instalação existente em mídia local;
4. mapear modelos existentes para o Model Registry;
5. preservar dados/modelos sem cópia destrutiva;
6. permitir bootstrap opcional e explícito de componentes ausentes;
7. registrar health/status sem transformar ausência em erro global do Studio.

## Gates para esta integração

### Cloud

- lint
- typecheck
- unit
- integration
- security
- build
- testes de contratos do menu/registries
- testes fail-closed de skill/provider/runtime

### Hosted Windows

- Electron E2E
- ConPTY
- portable runtime discovery
- package Windows
- AI Lab root detection

### Windows/local real

- USB/SSD removível real
- Ollama/modelo real do usuário
- preservação de dados existentes
- hardware específico
- performance térmica/memória/VRAM

Esses gates locais permanecem separados e nunca devem ser inferidos a partir de CI.

## Fases de implementação

### U0 — Contratos e menu
Criar manifesto de capacidades e Control Center read-only, preservando comportamento existente.

### U1 — Provider/Model Control
Centralizar status e seleção explícita de provider/modelo no Control Center.

### U2 — Skill Control
Expor Skill Registry, auditoria, aprovação e enable/disable por projeto.

### U3 — Toolbox Gates
Executar boas práticas e auditorias sob demanda com evidência e estados formais.

### U4 — Portable AI Lab Runtime
Introduzir Portable Runtime Registry e detectar estrutura AI Lab existente sem copiar ou apagar dados.

### U5 — Agent Loadouts
Associar agentes a modelos, providers, skills e políticas por projeto.

### U6 — Certification
Cloud + hosted Windows + validação física USB/SSD antes de RELEASE-GREEN.

## Não objetivos

- não transformar o Toolbox em executor irrestrito;
- não baixar todos os modelos automaticamente;
- não remover modelos existentes;
- não exigir que todas as ferramentas do antigo AI Lab estejam instaladas para o Studio abrir;
- não fundir caches/modelos/binários no Git;
- não eliminar as fronteiras de segurança já existentes.
