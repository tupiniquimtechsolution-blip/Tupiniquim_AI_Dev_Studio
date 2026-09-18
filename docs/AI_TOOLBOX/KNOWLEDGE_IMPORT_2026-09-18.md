# Knowledge Import — 2026-09-18

## Escopo

Import seletivo para o Tupiniquim AI Toolbox a partir de:
- ZIP `free-claude-code-main.zip`;
- ZIP `OpenManus-main.zip`;
- 6 infográficos de segurança `dutrasec_*`;
- vídeo `subi_pra_nuvem_*.mp4` (conteúdo visual amostrado);
- vídeo `ka.lippi_*.mp4` (conteúdo visual amostrado).

Os binários **não** são copiados para o repositório. O repositório recebe somente conhecimento normalizado, políticas e hashes de proveniência. Isso evita bloat, problemas de licença de mídia e importação acidental de conteúdo executável não auditado.

## Limites da extração

- Os ZIPs foram inspecionados diretamente e tiveram README/código relevante amostrado.
- Os vídeos foram analisados por frames representativos; não houve transcrição integral de áudio. Portanto, somente afirmações visíveis/claras foram incorporadas.
- Infográficos e vídeos sociais são fontes de descoberta, não autoridade. Conceitos foram normalizados para regras Tupiniquim em `SECURITY_BASELINE.md`.

## Source Gate

Todo conteúdo externo entra como `REFERENCE` até uma adoção explícita por projeto.

Antes de virar runtime/dependência:
1. origem/canonical upstream;
2. licença;
3. commit/ref conhecido;
4. scripts de instalação/build;
5. permissões e acesso à rede;
6. tratamento de secrets/credenciais;
7. superfície de supply chain;
8. testes/quality gates;
9. compatibilidade com AGENTS/PolicyEngine;
10. decisão `ADOPT`, `REFERENCE` ou `REJECT` documentada.

## Free Claude Code — conhecimento extraído

Upstream identificado pelo README: `Alishahryar1/free-claude-code`, licença MIT.

Padrões relevantes observados no snapshot:
- catálogo/provider runtime separados do harness;
- provider generations/leases para ownership e troca segura de runtime;
- code sessions persistidas em SQLite com state transitions;
- connected accounts desacopladas de model config;
- Admin local-only com validação de client loopback, `Host` e `Origin`;
- provider-specific smoke/E2E e progressive startup;
- failure/recovery policy separada do transporte.

Decisão Tupiniquim: `REFERENCE`.

Não importar:
- auto-fallback/prioridade de provider/model como política global;
- credenciais/sessões de outro home;
- installers sem revisão;
- claims de quantidade/disponibilidade de providers como contrato estável.

## OpenManus — conhecimento extraído

Upstream identificado pelo README: `FoundationAgents/OpenManus`, licença MIT.

Padrões relevantes observados no snapshot:
- `BaseAgent` com estados, step budget e stuck-loop detection;
- planning flow com estados explícitos por passo;
- `ToolCollection` com dispatch por nome e falha para tool inválida;
- MCP stdio/SSE com refresh de tool schemas e cleanup em `finally`;
- sandbox manager com limite, locks, idle timeout e cleanup;
- browser/search/crawl/file/shell como tools separadas.

Decisão Tupiniquim: `REFERENCE`.

Não importar:
- memória do agente como fonte de verdade;
- API key config como requisito global;
- shell/browser/network sem PolicyEngine;
- auto-pull de imagens/dependências em produção sem supply-chain gate.

## Segurança — normalização dos infográficos

### Firewalls

Os materiais listam packet filtering, stateful inspection, circuit gateway, proxy, cloud firewall, application layer, NGFW, UTM, WAF e distributed firewall.

Normalização Tupiniquim:
- não escolher “um tipo vencedor”; aplicar defesa em profundidade conforme threat model;
- WAF é camada HTTP, não substitui AppSec;
- cloud/security-group/host/network policy podem coexistir;
- default deny/least exposure quando viável;
- logs e atualização de regras fazem parte do controle.

### Criptografia

Os materiais citam simétrica/assimétrica, AES, RSA, ECC, ChaCha20, 3DES, Blowfish, Twofish e one-time pad.

Normalização Tupiniquim:
- TLS moderno para trânsito;
- usar bibliotecas consolidadas e AEAD para cifragem de aplicação quando necessária;
- 3DES/Blowfish não são defaults para novos projetos;
- não criar crypto própria;
- key management separado dos dados.

### Autenticação

Os materiais citam senha, PIN, OTP, biometria, 2FA/MFA, chave física, certificado, token e passwordless.

Normalização Tupiniquim:
- autenticação e autorização são fronteiras diferentes;
- preferir MFA resistente a phishing/passkeys/hardware keys em contas críticas quando suportado;
- OTP é fator secundário, não garantia universal;
- tokens com escopo/TTL/revogação;
- biometria conforme plataforma;
- certificados/mTLS para identidade máquina-a-máquina quando aplicável.

### Threat actors e ameaças

Os materiais destacam insider, externo, físico, erro humano, supply chain, credenciais, rede, aplicações, cloud e IoT; e uma taxonomia de “hats”.

Normalização Tupiniquim:
- threat model deve cobrir as categorias relevantes;
- supply chain exige lockfile, audit, revisão de scripts e proveniência;
- classificar operação ofensiva por autorização/escopo, não pela cor do “hat”.

## Vídeo DDoS/API Gateway — conhecimento visível incorporado

Frames mostram explicação simplificada de DoS/DDoS, limite de requisições e API Gateway como camada de proteção.

Normalização Tupiniquim:
- rate limit/quota por identidade/rota é controle de abuso;
- API Gateway pode centralizar limits/auth/routing;
- DDoS volumétrico exige também proteção upstream/edge; app/API Gateway sozinho não é garantia completa.

## Vídeo de continuidade/“canary” — conhecimento visível incorporado

Frames mostram um “Canary” usado como sinal de alerta quando o assistente perde contexto, com exemplo de instrução persistente de tratamento pelo nome.

Normalização Tupiniquim:
- canary determinístico e **não sensível** pode detectar context reset;
- canary não é memória canônica;
- se falhar, recarregar AGENTS/planejamento/checkpoint/banco;
- nunca usar segredo ou dado pessoal como canary;
- durabilidade é provada por persistência/checkpoint, não por “a IA lembra”.

## Arquivos canônicos atualizados

- `docs/AI_TOOLBOX/REPOSITORIES.md`
- `docs/AI_TOOLBOX/SECURITY_BASELINE.md`
- `.agents/skills/tupiniquim-toolbox/SKILL.md`
- `scripts/sync-ai-toolbox.ps1`
- `docs/AI_TOOLBOX/generated/knowledge-import-2026-09-18.json`
