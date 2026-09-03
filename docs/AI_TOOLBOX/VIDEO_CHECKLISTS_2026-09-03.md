# Extração inicial dos vídeos — 2026-09-03

Este arquivo registra o que pôde ser confirmado visualmente nos vídeos enviados. Pontos dependentes apenas de áudio ficam marcados como pendentes para evitar inventar conteúdo.

## 99hud — Strix / pentest com IA

Confirmado visualmente:
- Strix apresentado como “AI agents for penetration testing”.
- Exemplos de achados exibidos: chave de API exposta no cliente, senha fraca aceita no cadastro, rota de admin sem autenticação e dados de usuário sem criptografia.
- Fluxo mostrado: recon → validação → exploração → auth/injeção, execução contra app e relatório de segurança.

Ação adotada: adicionar `usestrix/strix` ao catálogo e transformar pentest autorizado em gate de segurança opcional/forte para projetos expostos.

## a.calorio — scanner de segurança ligado ao GitHub

Confirmado visualmente:
- login “Continuar com GitHub” em ferramenta chamada GitGuard;
- seleção/scan de múltiplos repositórios;
- painel de vulnerabilidades;
- vídeo afirma “435 vulnerabilidades reais encontradas”.

O produto/repositório exato não foi confirmado com segurança. A prática foi incorporada sem amarrar a uma ferramenta: secret scanning, auth/access-control, injection/SAST/DAST e revisão pré-deploy.

## hous3.digital — checklist de segurança

O texto visível apenas chama para receber um “checklist de segurança”. Os itens são falados, mas não aparecem na tela amostrada. Pendente de transcrição de áudio; nenhum item específico foi inventado.

## mxcdigital.co — 20 alertas antes de colocar site no ar

Lista visível no vídeo:
1. esperar perfeição
2. texto primeiro
3. copiar
4. “bem vindo”
5. foto genérica
6. carrossel
7. vídeo pesado
8. pop up
9. form grande
10. tel sem ser clicável
11. botão cobrindo
12. texto miúdo
13. placeholder
14. sexta à noite
15. tema genérico
16. /admin indexado
17. dado em dev
18. senhas
19. domínio ruim
20. voltar atrás

Interpretação operacional: tratar a lista como anti-padrões/gates de pré-launch, com contexto; não como proibições absolutas.

## natan_cardoso0 — checklist de publicação

Cartões confirmados:
1. Cadastre no Google — conectar Search Console e enviar sitemap.
2. Configure o Google Maps — preencher Perfil da Empresa e adicionar link do site.
3. Ative o monitoramento — Vercel Web Analytics ou Google Analytics.
4. Envie o site para o Bing — Bing Webmaster Tools + sitemap.
5. Teste a velocidade — PageSpeed/Speed Insights, especialmente mobile.
6. Revise cada título — títulos/metadados coerentes e únicos.
7. Prepare uma forma de voltar — Git, backups do banco e rollback de deploy.
8. Proteja o projeto — revisar firewall, variáveis de ambiente e formulários.
9. Conecte as páginas — links internos entre serviços, artigos e páginas relacionadas.
10. Apareça localmente — diretórios/sites locais quando pertinente.

## ravaneda.ia — segurança de vibe coding (vídeo 1)

Confirmado visualmente:
- alerta de que vibe coding pode ser perigoso antes de publicar;
- inspeção de client/browser em busca de chaves/segredos;
- autenticação/cookies;
- rate limiting;
- referência a proteção de endpoints/admin.

Ação: incorporar segredos, cookies/sessões, autorização e rate limiting à baseline.

## ravaneda.ia — segurança de vibe coding (vídeo 2)

Confirmado visualmente:
- menção a APIs/endpoints;
- logos do Cloudflare e de uma segunda ferramenta de rate limiting/segurança ainda não identificada com confiança;
- foco em proteção contra abuso/alto volume.

Ação: exigir CDN/WAF/rate limiting quando aplicável. A segunda ferramenta não foi cadastrada até identificação confiável.

## _gustavocampelo — microdicas CSS

Confirmado nas imagens/vídeo:
- `white-space: nowrap` para conteúdo que realmente precisa permanecer em uma linha;
- shorthand `font` quando simplifica um conjunto coerente de propriedades;
- `letter-spacing` com critério, especialmente em caixa alta;
- `inset` para substituir top/right/bottom/left quando os valores permitem.

Regra: são dicas de legibilidade/manutenção, não obrigação cega. Responsividade e acessibilidade têm prioridade.

## felipetambara.ia — Prompt Master

O vídeo mostra o repositório `nidhinjs/prompt-master`, instalação como Skill do Claude e proposta de gerar prompts mais precisos mantendo contexto/decisões.

Ação: classificado como skill global recomendada para engenharia de prompts.

## oluizsampaio — 21 itens para abrir primeira empresa

Itens visíveis:
1. iPhone
2. Nome
3. Id. Visual
4. Logo
5. Tipografia
6. Cartão de Visita
7. Conta do Insta
8. Link de Bio
9. 9 Reels Estratégicos
10. Tabela de Preços
11. Cálculo de Margem
12. Benchmark
13. Modelo de Contrato
14. Script de Reunião
15. Slide de Reunião
16. Wpp Business
17. CNPJ
18. Contador
19. Conta Bancária CNPJ
20. Sócio
21. item final não ficou legível na amostragem

Ação: manter como checklist comercial/operacional separado; não transformar itens pessoais/legais em regra técnica automática.

## tiagorocha.ai — stack de IA

Vídeo menciona Cursor e discute stack para código, automações, gestão de versões e e-mail. Os nomes adicionais não ficaram visíveis de forma suficiente na amostragem atual. Pendente de extração complementar antes de cadastrar ferramentas.

## gabrielfagundes.ai

Somente a frase “Sobe seu SaaS aí” ficou visível; conteúdo substantivo depende de áudio. Pendente de transcrição.

## Política para próximos vídeos

- Repositório/ferramenta claramente identificável: localizar fonte oficial, classificar e adicionar ao catálogo.
- Dica/lista/checklist sem software: transformar em regra ou checklist apenas quando verificável.
- Conteúdo ambíguo: marcar pendente; não adivinhar.
- Toda nova regra deve indicar se é obrigatória, recomendada, condicional ou apenas referência.
