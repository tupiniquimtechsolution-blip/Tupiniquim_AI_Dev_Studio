# Baseline de Segurança e Pré-Deploy — Tupiniquim

Esta baseline transforma os checklists dos vídeos recebidos em regras verificáveis. Ela vale para novos projetos e para manutenção dos existentes. Ajuste por tecnologia sem reduzir o nível de proteção.

## Segredos e configuração

- Nenhuma API key, token, senha, cookie de sessão ou credencial pode estar no frontend, bundle, repositório ou log.
- Variáveis públicas (por exemplo `NEXT_PUBLIC_*`) nunca podem conter credenciais de backend ou chaves privilegiadas.
- Revisar histórico Git quando houver suspeita de segredo já commitado; rotacionar o segredo, não apenas apagar o arquivo atual.
- Manter `.env*` sensíveis fora do Git e fornecer somente `.env.example` sem valores reais.

## Autenticação e autorização

- Toda rota administrativa ou mutação sensível exige autenticação e autorização no servidor.
- Não confiar em esconder rota no frontend.
- Senhas devem usar hash forte e política mínima adequada; nunca texto puro.
- Sessões/cookies devem usar atributos seguros quando aplicável: HttpOnly, Secure e SameSite.
- Separar claramente permissões de usuário, operador/admin e integrações.

## API e entrada de dados

- Validar e sanitizar entrada no servidor.
- Proteger contra SQL/command injection, XSS, CSRF, SSRF e path traversal conforme a stack.
- Aplicar rate limiting a login, recuperação de senha, formulários públicos, webhooks e endpoints de custo/IA.
- Limitar payload, paginação e operações potencialmente caras.
- Não retornar stack traces, secrets ou detalhes internos em erros de produção.

## Dados e privacidade

- Dados pessoais/sensíveis devem ter proteção compatível com o risco, inclusive em trânsito e, quando necessário, em repouso.
- Coletar apenas o necessário e documentar retenção/remoção.
- Logs não devem conter senha, token, cookie, documento pessoal completo ou payload sensível desnecessário.

## Infraestrutura e deploy

- HTTPS obrigatório em produção.
- Revisar firewall/WAF/CDN, CORS, headers de segurança e exposição de portas.
- `/admin`, painéis internos e páginas de diagnóstico não devem ser indexados nem expostos sem controle.
- Produção não pode depender de dados/credenciais de desenvolvimento.
- Ter rollback verificável: Git + estratégia de deploy + backup de banco quando existir.
- Backups devem ser testados por restauração, não apenas criados.

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
- Strix pode ser usado para pentest autorizado e validação de remediações;
- qualquer achado crítico/alto deve bloquear produção até correção ou aceite de risco documentado.

## Gate de Claude

Ao trabalhar em código da empresa, Claude deve:
1. investigar antes de alterar;
2. não inventar estado do repositório;
3. limitar mudanças ao escopo;
4. executar verificações disponíveis;
5. registrar riscos e evidências;
6. pedir confirmação antes de ações destrutivas, migrações irreversíveis, publicação externa ou alteração de dados reais.
