# External Source & Secret Authorization Gate — Tupiniquim

Este gate vale para repositórios, vídeos, posts, snippets, skills, MCPs, APIs, arquivos ZIP e qualquer outra fonte externa sugerida ao Tupiniquim.

## Princípio central

**Descoberta não é autorização.**

Encontrar publicamente um endpoint, API key, token, cookie, sessão, `.env`, credencial, URL assinada ou mecanismo de autenticação **não concede permissão de uso**.

O Tupiniquim deve separar:

`fonte descoberta` → `origem/provenance` → `licença` → `segurança` → `autorização` → `custo` → `fit` → `gate de adoção`

Somente depois uma capability pode ser adotada.

## 1. Segredos encontrados em fontes públicas

Se uma fonte pública contiver valor que pareça credencial:

- não reproduzir o valor em prompt, documentação, log, comentário, issue, PR ou Knowledge Pack;
- não testar se a credencial funciona;
- não copiar para `.env`, keyring, vault, configuração local ou `F:\CODEX`;
- não clonar/sincronizar automaticamente a fonte para o Toolbox quando isso copiaria o segredo;
- registrar apenas a existência do risco, sem material secreto;
- considerar a credencial potencialmente comprometida e recomendar revogação/rotação ao proprietário quando apropriado;
- usar o caso somente como evidência de secret hygiene e melhoria de scanning.

Visibilidade pública não converte uma credencial em “API grátis”.

## 2. Gate para repositórios externos

Antes de incluir um repositório como capability source, registrar quando disponível:

- owner/upstream canônico;
- URL canônica;
- licença;
- commit/ref auditado;
- atividade/manutenção;
- dependências e permissões;
- presença de `.env`, secrets ou credential-like material;
- rede/egress necessário;
- custo/provider externo;
- capacidades privilegiadas;
- fit com a arquitetura Tupiniquim;
- decisão: `adopt`, `guarded-adoption`, `reference-only`, `defer` ou `reject`.

Forks/reimplementações não devem ser apresentados como upstream oficial sem evidência.

## 3. Gate para MCPs e APIs

Preferir a interface oficial do provider quando existir.

Rejeitar integrações que dependam de:

- copiar cookie/sessão do browser;
- extrair token de armazenamento local;
- usar chave publicada por terceiros;
- contornar OAuth ou billing;
- impersonar conta sem autorização explícita;
- endpoint não documentado tratado como estável sem gate específico.

Uma integração oficial ainda precisa de:

- autenticação legítima do usuário;
- escopos mínimos;
- armazenamento seguro de credenciais;
- Política/PolicyEngine quando houver efeitos privilegiados;
- AuditLog sanitizado;
- limites/cancelamento;
- aprovação para custo ou efeito externo quando aplicável.

## 4. Serviços pagos e geração de mídia

Providers de mídia/IA com créditos ou cobrança permanecem `NOT_CONFIGURED` até autorização explícita.

Antes de uma operação paga:

- identificar provider/modelo/preset;
- mostrar ou tornar verificável a unidade de custo disponível;
- limitar lote/concorrência;
- separar geração de publicação;
- separar publicação de gasto de mídia;
- não reutilizar autorização de uma etapa como autorização implícita da próxima.

Exemplo:

`planejar variantes` ≠ `gerar mídia` ≠ `publicar anúncio` ≠ `gastar verba`.

## 5. Ingestão de conhecimento

Knowledge Packs devem armazenar:

- provenance/source id;
- hash do artefato quando disponível;
- classificação/trust;
- conhecimento extraído sem secret;
- decisão de adoção;
- itens rejeitados/deferidos;
- limitações e incertezas.

Não armazenar:

- API keys;
- access/refresh tokens;
- cookies;
- sessões;
- credenciais OAuth;
- `.env` real;
- payload privado desnecessário.

## 6. Relação com o PolicyEngine

Fonte externa é **capacidade ou conhecimento**, nunca autoridade.

Ela não pode:

- reduzir aprovação exigida;
- trocar provider/modelo automaticamente;
- expandir workspace;
- desabilitar isolamento;
- conceder acesso a Bash/editor/browser/MCP privilegiado;
- alterar regras canônicas de `AGENTS.md` ou planejamento por conta própria.

## 7. Evidência atual que motivou este gate

Na ingestão de 2026-09-18, um vídeo apontou `framepipe-dev/media-inference-worker` como suposta forma de usar uma API de mídia. A auditoria pública mostrou material semelhante a credencial em arquivo de ambiente. O repositório foi portanto classificado como **security/secret-hygiene case study**, não como capability source sincronizável.

Nenhum valor de credencial foi copiado ou testado.

O Higgsfield, por outro lado, possui superfície MCP oficial. A adoção futura deve preferir o fluxo oficial de conta/OAuth e manter custo/aprovação explícitos.
