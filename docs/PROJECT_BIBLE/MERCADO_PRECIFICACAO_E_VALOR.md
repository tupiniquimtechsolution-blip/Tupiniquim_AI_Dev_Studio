# Mercado, Precificação e Valor Econômico de Referência

Atualizado em: 2026-09-22

> Este documento não é laudo de valuation, proposta comercial fechada nem promessa de receita. Ele organiza benchmarks públicos e cria envelopes de planejamento. Valores devem ser revisados antes de qualquer negociação.

## 1. Benchmarks externos — setembro/2026

Fontes consultadas:
- Clutch, Software Development Company Pricing Guide 2026: projetos típicos revisados entre US$ 10 mil e US$ 49.999; média reportada de aproximadamente US$ 132 mil; faixa comum de empresas de desenvolvimento US$ 25–49/h.
- Clutch, empresas de software no Brasil/São Paulo: fornecedores destacados aparecem majoritariamente em US$ 25–49/h ou US$ 50–99/h, com projetos mínimos frequentemente entre US$ 5 mil e US$ 100 mil+ conforme porte.
- Upwork 2026: desenvolvimento/IA/consultoria especializada pode alcançar aproximadamente US$ 75–150+/h; software developers em faixa ampla de US$ 10–100/h.
- GitHub Copilot 2026: Pro US$ 10/mês, Pro+ US$ 39, Max US$ 100; Business US$ 19/usuário/mês; Enterprise US$ 39/usuário/mês, além de modelo de AI credits.
- ChatGPT/Codex 2026: produtos individuais variam por plano e uso; Plus/Pro e Business/Enterprise servem como referência de disposição a pagar por tooling de IA, não como comparável perfeito.

URLs de referência:
- https://clutch.co/developers/pricing
- https://clutch.co/br/developers
- https://clutch.co/br/developers/s%C3%A3o-paulo
- https://www.upwork.com/resources/upwork-hourly-rates/
- https://github.com/features/copilot
- https://docs.github.com/en/copilot/get-started/plans
- https://developers.openai.com/docs/pricing

Câmbio de referência usado para conversão de planejamento em 2026-09-22: **US$ 1 ≈ R$ 5,1235**. Não usar como cotação contratual futura.

## 2. Faixas de custo/hora para planejamento

| Perfil | USD/h | BRL/h aproximado |
|---|---:|---:|
| Desenvolvimento genérico/outsourcing | 25–49 | R$ 128–251 |
| Agência BR especializada / produto complexo | 50–99 | R$ 256–507 |
| Especialista AI/arquitetura/consultoria | 75–150+ | R$ 384–769+ |

Para este projeto, uma faixa de reposição coerente deve ponderar desktop Electron, segurança, providers/modelos, agentes, QA, Windows packaging, RAG/research, multimodal e governança. Portanto, usar apenas a faixa mais baixa subestima o escopo.

## 3. Envelope de esforço — não é medição de horas reais

Estimativa de engenharia de reposição, criada por decomposição do roadmap. Deve ser substituída por apontamento real quando disponível.

| Bloco | Horas estimadas de reposição |
|---|---:|
| Fundação + segurança + IPC + persistência (Wave 0) | 350–600 h |
| Dev AI local + sessões/providers/recovery/RC1 (Wave 1) | 700–1.200 h |
| Fechamento dos gaps V1 atuais | 350–650 h |
| Research/Knowledge/Registries (Wave 2) | 500–850 h |
| Dev Studio completo/hardening (Wave 3) | 450–750 h |
| Agent Registry/multiagente (Wave 4) | 500–850 h |
| Multimodal/voz/automação (Wave 5) | 450–900 h |
| Productização, release, docs, suporte inicial | 250–450 h |

Envelope do produto completo: **~3.550–6.250 h** de reposição profissional. A parcela já construída não implica que essas horas tenham sido efetivamente gastas; é um proxy de custo para contratar uma equipe equivalente.

## 4. Custo de reposição indicativo

Usando faixa de agência especializada no Brasil (aprox. R$ 256–507/h):

- produto completo no envelope acima: **~R$ 909 mil a R$ 3,17 milhões**;
- apenas gaps V1 atuais (350–650 h): **~R$ 90 mil a R$ 330 mil**;
- futuras Waves 2–5 + productização (~2.150–3.800 h): **~R$ 550 mil a R$ 1,93 milhão**.

Isso é **replacement cost**, não valuation societário. Valuation depende de receita, churn, margem, crescimento, propriedade intelectual, risco, time, distribuição e prova de mercado.

## 5. Partes precificáveis como serviços/projetos

1. Setup local/enterprise AI workstation: diagnóstico, instalação, modelos, hardening e treinamento.
2. Integração de provider/modelo: adapter, auth, policy, observability e testes.
3. Knowledge/RAG Pack por empresa: ingestão, isolamento, citations e governança.
4. Tool/MCP/Skill onboarding: análise de segurança/licença/custo + integração.
5. Agentes especializados: Planner, Researcher, Coder, QA, UX, Prompt, Media, Knowledge.
6. Automação de workflow: aprovação, audit trail, Tasks/CRM/GitHub/Notion/Miro e conectores.
7. White-label / enterprise customization: branding, políticas, providers permitidos e deployment.
8. Hardening/QA: threat model, security gates, E2E, dogfood e release engineering.
9. Suporte/maintenance: updates, models, compatibility, incident handling e evidence retention.

## 6. Hipótese inicial de monetização SaaS/software

Comparáveis como GitHub Copilot situam tooling de coding AI individual entre aproximadamente US$ 10–100/mês e business/enterprise em ~US$ 19–39/seat/mês, com cobrança adicional por uso em certos planos. O Tupiniquim pretende agregar local-first, multi-provider, policy/audit, research, agents, knowledge e multimodal, portanto não deve competir apenas por preço de autocomplete.

Faixas de teste comercial sugeridas — **hipóteses, não preços finais**:

- Community/Local: R$ 0 — recursos locais básicos, BYO runtime/modelos.
- Pro Local: R$ 79–149/mês — desktop, workspace, providers locais, modos essenciais.
- Power/Agent: R$ 199–349/mês — agentes, research/knowledge, advanced workflows e maior governança.
- Team: R$ 99–199 por usuário/mês, com mínimo de seats ou base mensal.
- Business: R$ 249–499 por usuário/mês ou pacote-base R$ 1.490–4.990/mês conforme suporte/governança.
- Enterprise/On-prem: contrato anual/custom, onboarding e SLA separados; ponto de partida comercial a validar com clientes, não inferior ao custo de suporte e implantação.

## 7. Serviços profissionais sugeridos

- Discovery/arquitetura: R$ 5 mil–20 mil.
- Setup empresarial local seguro: R$ 10 mil–40 mil.
- Integração custom provider/tool/MCP: R$ 8 mil–50 mil por integração conforme risco/complexidade.
- Knowledge/RAG empresarial: R$ 15 mil–80 mil.
- Agente especializado custom: R$ 15 mil–100 mil.
- White-label/deployment/hardening: R$ 30 mil–200 mil+.

Essas faixas são envelopes comerciais derivados de horas/complexidade e benchmarks; devem passar por discovery e SOW antes de proposta.

## 8. Métricas necessárias antes de valuation ou fundraising

MRR/ARR, número de usuários ativos, ativação, retenção/churn, custo de inferência, gross margin, CAC, payback, LTV, uso local vs cloud, custo de suporte por conta, conversão free→paid, NPS/qualidade, tempo economizado e número de workflows concluídos com evidência.

## 9. Próximo gate comercial

Somente após V1 utilizável: benchmark de concorrentes por feature, entrevistas com 10–20 usuários-alvo, teste de willingness-to-pay, piloto com 3–5 clientes, coleta de telemetria opt-in/privacidade, definição de packaging/licença e revisão tributária/contratual.
