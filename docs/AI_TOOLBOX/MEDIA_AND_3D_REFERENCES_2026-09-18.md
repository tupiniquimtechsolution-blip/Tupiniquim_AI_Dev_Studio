# Tupiniquim AI Toolbox — Media, 3D e Higgsfield — 2026-09-18

Este documento registra a extração dos três vídeos adicionais recebidos em 2026-09-18. O objetivo é preservar conhecimento útil sem transformar conteúdo viral, repositórios de terceiros ou serviços pagos em autoridade operacional.

## Política de ingestão

- conteúdo de vídeo é referência até validação;
- repositório externo é fonte não confiável até gate de origem, licença, segurança, manutenção, custo e fit;
- nunca copiar credenciais, `.env`, cookies, tokens ou sessões de repositórios públicos;
- serviços pagos/networked permanecem `NOT_CONFIGURED` até autorização explícita;
- provider/modelo/ferramenta continuam selecionados explicitamente pelo usuário;
- descoberta de um endpoint ou credencial pública nunca significa autorização de uso.

## 1. WorldClaw — geração agentic de mundos 3D

### Evidência do vídeo

O vídeo mostra o projeto **WorldClaw**, cenas 3D abertas geradas a partir de descrição, regiões de terreno, objetos editáveis e artefatos auxiliares para composição/edição.

### Fonte verificada

Paper: `WorldClaw: Agentic 3D Open-World Generation at Scale` — Chunchao Guo, Jinpeng Li, Yang Li e Zilong Huang, arXiv:2608.05248, 2026-08-05.

Fonte: https://arxiv.org/abs/2608.05248

O paper descreve uma arquitetura agentic coarse-to-fine: planejamento transforma prompt aberto em especificação estruturada de regiões, terreno, assets, materiais e relações espaciais; depois o sistema constrói terreno global, reutiliza assets e aplica refinamento orientado por render.

### Decisão Tupiniquim

Classificação: **Research / 3D World Generation Reference**.

Aproveitar como padrões:
- decomposição prompt → regiões → terreno → assets → relações espaciais;
- planejamento separado da execução de geração;
- assets instance-level editáveis e reutilizáveis;
- refinamento por render/evidência visual;
- provenance de assets e etapas intermediárias;
- geração 3D tratada como pipeline potencialmente caro, com limites e aprovação.

Não adotar automaticamente:
- infraestrutura/GPU cluster;
- providers pagos usados pelo paper;
- reimplementações de terceiros como se fossem o upstream oficial;
- geração autônoma ilimitada.

Até esta auditoria, **nenhum repositório oficial do WorldClaw foi confirmado**. Reimplementações públicas encontradas são referências secundárias e não entram no backup canônico por enquanto.

## 2. `framepipe-dev/media-inference-worker` — caso de segurança, não capability source

### Evidência do vídeo

O vídeo aponta um repositório público associado a uso de media inference/Higgsfield e divulga a ideia de uma API supostamente disponível gratuitamente.

Repositório identificado:
`framepipe-dev/media-inference-worker`

### Achado de segurança

A inspeção pública mostrou um arquivo `.env` com valores que se parecem com credenciais de API e código que monta header de autenticação para a plataforma de mídia.

**Nenhum valor de credencial é reproduzido, armazenado, clonado ou inserido no Toolbox.**

### Decisão Tupiniquim

Classificação: **Security Incident / Secret Hygiene Case Study**.

- NÃO adicionar esse repositório ao script de sync/backup;
- NÃO tratar credencial pública como autorização de uso;
- NÃO testar a credencial;
- NÃO copiar `.env` ou qualquer segredo para `F:\CODEX`;
- usar o caso para reforçar secret scanning, bloqueio de `.env`, revisão de histórico e rotação/revogação quando um segredo é exposto;
- serviços externos devem usar credencial própria, obtida legitimamente pelo usuário e armazenada em mecanismo seguro.

Regra derivada: repositório viral que promete “API grátis” passa primeiro por **Secret/Authorization Gate**. Se a capacidade depender de credencial aparentemente vazada, a capacidade é rejeitada.

## 3. Higgsfield MCP + Ad Multiplier

### Evidência do vídeo

O vídeo mostra um fluxo de multiplicação de criativos: um anúncio/base e referências de personagem, roupa, local e idioma são usados para produzir múltiplas variações de mídia para campanhas.

### Fonte oficial verificada

Higgsfield mantém MCP oficial em:
`https://mcp.higgsfield.ai/mcp`

Página oficial:
`https://higgsfield.ai/mcp`

A documentação oficial informa que o MCP usa autorização da conta e que gerações automatizadas consomem créditos conforme a política do serviço.

### Decisão Tupiniquim

Classificação: **Media Provider / MCP Capability — OPTIONAL, PAID/NETWORKED**.

Pode ser usado futuramente no Media Agent mediante:
- conexão oficial do Higgsfield;
- OAuth/fluxo oficial, sem copiar tokens manualmente;
- usuário selecionar explicitamente provider/modelo/workflow;
- mostrar custo/crédito e pedir aprovação antes de geração paga quando aplicável;
- registrar request, provider, modelo/preset, asset de origem, output e custo/provenance sem registrar segredo;
- rate limit, cancelamento e limites de lote;
- nenhuma publicação automática em Meta Ads sem uma segunda autorização específica.

### Padrão Ad Multiplier

Fluxo recomendado:

`creative base` → `referências` → `matriz de variações` → `preview/plano` → `aprovação` → `geração` → `QA` → `assets versionados` → `publicação opcional separada`

Dimensões possíveis da matriz:
- personagem;
- roupa/produto;
- local/cenário;
- idioma/região;
- hook/copy;
- formato/aspect ratio;
- CTA;
- duração.

Guardrails:
- não multiplicar combinações sem limite;
- evitar gasto invisível de créditos;
- preservar identidade/provenance de assets;
- revisar direitos de imagem/marca e consentimento;
- Meta Paid Ads é destino opcional, não autorização implícita de publicação ou gasto de mídia.

## 4. Regra para MCPs e wrappers não oficiais

O Higgsfield declara como oficial a superfície `higgsfield.ai`, API/documentação oficiais e `mcp.higgsfield.ai/mcp`.

Wrappers comunitários podem ser estudados como implementação de referência, mas:
- não são tratados como upstream oficial;
- fluxos que extraem tokens de browser, cookies ou sessões são rejeitados;
- qualquer integração futura deve preferir a interface oficial e passar pelo PolicyEngine/approval/cost gate do Tupiniquim.

## 5. Relação com o roadmap

Estas fontes **não mudam a Wave 17** e não autorizam Master Wave 2.

Entram no backlog do AI Toolbox/Media/3D para adoção somente quando a Wave correspondente permitir. A correção da Issue #25 e o fechamento da Master Wave 1 continuam prioritários e independentes desta ingestão.
