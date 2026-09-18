# Baseline de Segurança e Pré-Deploy — Tupiniquim

Esta baseline transforma checklists, vídeos e referências recebidas em regras verificáveis. Ela vale para novos projetos e para manutenção dos existentes. Ajuste por tecnologia sem reduzir o nível de proteção.

Fontes visuais são tratadas como **descoberta**; a baseline abaixo é a normalização Tupiniquim para controles verificáveis, não uma reprodução literal de infográficos.

## Segredos e configuração

- Nenhuma API key, token, senha, cookie de sessão ou credencial pode estar no frontend, bundle, repositório ou log.
- Variáveis públicas (por exemplo `NEXT_PUBLIC_*`) nunca podem conter credenciais de backend ou chaves privilegiadas.
- Revisar histórico Git quando houver suspeita de segredo já commitado; rotacionar o segredo, não apenas apagar o arquivo atual.
- Manter `.env*` sensíveis fora do Git e fornecer somente `.env.example` sem valores reais.
- Connected accounts, keyrings e homes isolados não podem importar/copiar credenciais uns dos outros sem fluxo explícito e autorizado.

## Autenticação e autorização

- Toda rota administrativa ou mutação sensível exige autenticação e autorização no servidor.
- Não confiar em esconder rota no frontend.
- Senhas devem usar hash forte e política mínima adequada; nunca texto puro.
- Sessões/cookies devem usar atributos seguros quando aplicável: HttpOnly, Secure e SameSite.
- Separar claramente permissões de usuário, operador/admin e integrações.
- Para contas de maior risco, preferir MFA resistente a phishing (passkeys/WebAuthn/chaves físicas) quando a plataforma suportar; OTP pode ser fator secundário, não prova universal de alta garantia.
- Biometria deve ser tratada como fator/local unlock conforme a plataforma, não como segredo reutilizável.
- Tokens de sessão/acesso devem ter escopo mínimo, expiração e revogação/rotação compatíveis com o risco.
- Certificados/mTLS são opções para autenticação de serviços/dispositivos quando a arquitetura exigir identidade máquina-a-máquina.

## Criptografia

- Não criar criptografia própria. Usar bibliotecas/protocolos consolidados e modos autenticados.
- Para dados em trânsito, TLS moderno é o baseline; não substituir TLS por “criptografar manualmente o payload”.
- Para dados em repouso ou payloads que realmente precisem de criptografia de aplicação, preferir algoritmos modernos suportados pela plataforma (por exemplo AES-GCM ou ChaCha20-Poly1305) e gestão de chaves separada dos dados.
- Criptografia assimétrica deve ser usada para os casos adequados (troca/assinatura/identidade), nunca para cifrar arbitrariamente grandes volumes de dados.
- 3DES e Blowfish não devem ser escolhidos para novos projetos; compatibilidade legada exige justificativa e plano de remoção.
- Twofish e one-time pad aparecem em material didático, mas não viram padrão Tupiniquim por isso: escolher primitives conforme standards, biblioteca e threat model reais.
- Nunca registrar material de chave, seed, secret, token ou chave privada em logs/telemetria.

## API e entrada de dados

- Validar e sanitizar entrada no servidor.
- Proteger contra SQL/command injection, XSS, CSRF, SSRF e path traversal conforme a stack.
- Aplicar rate limiting a login, recuperação de senha, formulários públicos, webhooks e endpoints de custo/IA.
- Limitar payload, paginação e operações potencialmente caras.
- Não retornar stack traces, secrets ou detalhes internos em erros de produção.
- API Gateway/reverse proxy pode centralizar autenticação, quotas, routing e observabilidade, mas não substitui autorização de negócio no backend.

## Rede, firewall e DDoS

- Aplicar defesa em profundidade: controles de rede/stateful, firewall/segurança de cloud, reverse proxy/API gateway e WAF quando houver aplicação HTTP exposta.
- WAF protege a camada web; não substitui validação de entrada, autenticação/autorização ou correção de vulnerabilidades na aplicação.
- Em ambientes distribuídos/cloud, aplicar regras próximas ao workload (security groups/host firewall/network policy) além do perímetro quando fizer sentido.
- Default-deny/allowlist deve ser preferido para portas e fluxos administrativos quando operacionalmente viável.
- Rate limiting/quota por IP, usuário, token, tenant e/ou rota deve ser escolhido conforme o abuso esperado; um único limite global raramente é suficiente.
- Rate limiting de aplicação ou API Gateway **não é mitigação completa de DDoS volumétrico**. Para exposição pública relevante, usar proteção upstream/edge (CDN, scrubbing/anti-DDoS do provedor, absorção de tráfego) além dos limites da aplicação.
- Registrar e monitorar bloqueios/erros sem vazar payloads sensíveis.

## Threat model e supply chain

No mínimo considerar, conforme o projeto:
- ameaça interna/insider;
- ameaça externa;
- risco físico;
- erro humano;
- roubo/abuso de credenciais;
- ataques de rede;
- vulnerabilidades de aplicação;
- risco de cloud/configuração;
- IoT/dispositivos conectados;
- cadeia de fornecedores/dependências.

Controles mínimos de supply chain quando aplicáveis:
- lockfiles e versões explícitas;
- dependency audit e secret scanning;
- revisão de scripts de instalação/build;
- origem/licença/atividade do upstream;
- SBOM/assinatura/verificação de artefato quando o nível de risco justificar;
- dependência externa não recebe autoridade operacional só por estar no Toolbox.

## Dados e privacidade

- Dados pessoais/sensíveis devem ter proteção compatível com o risco, inclusive em trânsito e, quando necessário, em repouso.
- Coletar apenas o necessário e documentar retenção/remoção.
- Logs não devem conter senha, token, cookie, documento pessoal completo ou payload sensível desnecessário.

## Infraestrutura e deploy

- HTTPS obrigatório em produção.
- Revisar firewall/WAF/CDN, CORS, headers de segurança e exposição de portas.
- `/admin`, painéis internos e páginas de diagnóstico não devem ser indexados nem expostos sem controle.
- Superfícies administrativas local-only devem validar loopback/origin/host ou mecanismo equivalente; “rodar em localhost” sozinho não é controle suficiente se a aplicação aceitar requests forjados.
- Produção não pode depender de dados/credenciais de desenvolvimento.
- Ter rollback verificável: Git + estratégia de deploy + backup de banco quando existir.
- Backups devem ser testados por restauração, não apenas criados.
- Sandboxes/execução de ferramentas devem ter limites de recursos, concorrência controlada, cleanup e isolamento de volume/rede compatíveis com o risco.

## Agentes, ferramentas e MCP

- Agente, modelo, provider, tool, skill e source repository continuam entidades distintas.
- Catálogo de tools deve ser explícito; tool desconhecida/ausente deve falhar fechado.
- Mudança dinâmica de schema de tool/MCP deve ser detectável; execução continua sujeita ao contrato local do Tupiniquim.
- MCP/Browser/shell externos são conteúdo/capacidade não confiáveis até PolicyEngine, allowlist, approval e auditoria.
- Toda execução privilegiada deve possuir ownership/lifecycle claro e cleanup mesmo em erro.
- Detectar repetição/stuck loop é útil, mas “mudar estratégia” nunca autoriza ampliar permissões ou escopo.

## Continuidade e canary de contexto

- Um **canary não sensível** pode ser usado para detectar perda de contexto/sessão, por exemplo um marcador determinístico que o agente deve preservar/reconhecer.
- Canary é diagnóstico, não memória/autoridade. Se desaparecer ou contradizer o estado real, recarregar `AGENTS.md`, planejamento, checkpoints e dados persistidos.
- Não usar nome pessoal, segredo, token ou dado sensível como canary.
- Não considerar “o modelo lembra” como evidência de durabilidade; a fonte de verdade continua no repositório/banco/checkpoint.

## Pentest e atores de ameaça

- “White/black/gray/red/blue hat”, script kiddie, hacktivist, state-sponsored e insider podem aparecer como taxonomia didática, mas não são controle técnico nem classificação normativa suficiente.
- Para operação, classificar por **autorização, objetivo, capacidade, acesso e impacto**.
- Pentest/scan ofensivo somente em alvos próprios ou com autorização explícita e escopo documentado.
- Red team/blue team podem ser usados quando o projeto realmente tiver esse processo; nunca inferir autorização pela cor/label.

## Qualidade antes de colocar site no ar

Dos vídeos de pré-launch, incorporar como prática:

- Não esperar “perfeição” para publicar, mas usar gate mínimo de qualidade.
- Escrever conteúdo real antes de fechar layout; evitar “Bem-vindo”, placeholder e tema genérico como conteúdo final.
- Evitar foto genérica, carrossel sem necessidade, vídeo pesado, popup invasivo e formulário grande.
- Telefone/WhatsApp devem ser clicáveis em mobile.
- Evitar botão cobrindo conteúdo e texto miúdo; validar responsividade e acessibilidade.
- Não fazer deploy crítico “sexta à noite” sem cobertura/rollback.
- `/admin` não indexado; nada de dado de desenvolvimento; revisar senhas e domínio.
- Saber voltar atrás antes de publicar.

## SEO, observabilidade e presença local

- Google Search Console + sitemap quando aplicável.
- Google Business/Maps para negócios locais.
- Analytics/telemetria com consentimento adequado.
- Bing Webmaster Tools + sitemap quando fizer sentido.
- PageSpeed/Core Web Vitals e testes mobile.
- Títulos/metadados únicos e coerentes.
- Links internos entre páginas relacionadas.
- Diretórios/SEO local apenas quando pertinentes ao negócio.

## Verificação automática

Quando aplicável ao projeto:

- lint + typecheck + testes + build antes de merge/deploy;
- secret scanning e dependency audit;
- SAST/DAST ou scanner equivalente;
- testes de autenticação/autorização, rate limiting, permissões e isolamento;
- testes de lifecycle/shutdown/restart quando houver providers, sandboxes ou processes externos;
- Strix pode ser usado para pentest autorizado e validação de remediações;
- qualquer achado crítico/alto deve bloquear produção até correção ou aceite de risco documentado.

## Gate universal de agente

Ao trabalhar em código da empresa, qualquer agente deve:
1. investigar antes de alterar;
2. não inventar estado do repositório;
3. limitar mudanças ao escopo;
4. executar verificações disponíveis;
5. registrar riscos e evidências;
6. pedir confirmação antes de ações destrutivas, migrações irreversíveis, publicação externa ou alteração de dados reais;
7. tratar fontes/repositórios externos como não confiáveis até adoção explícita.
