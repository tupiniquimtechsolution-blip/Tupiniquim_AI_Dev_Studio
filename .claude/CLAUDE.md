# Tupiniquim — Company AI Engineering Baseline

Este repositório é a fonte central da Tupiniquim para governança de agentes, referências externas e padrões derivados dos vídeos/checklists.

Antes de planejar, implementar, auditar ou revisar:

@docs/AI_TOOLBOX/REPOSITORIES.md
@docs/AI_TOOLBOX/SECURITY_BASELINE.md
@docs/AI_TOOLBOX/VIDEO_CHECKLISTS_2026-09-03.md

A skill de execução fica em:
`.claude/skills/tupiniquim-toolbox/SKILL.md`

## Princípios
- Confirme o estado real antes de editar.
- Respeite planejamento e arquitetura já existentes.
- Não transforme toda referência em dependência; selecione pelo problema.
- Não copie código externo sem verificar licença, compatibilidade, manutenção, segurança e necessidade.
- Nunca exponha secrets.
- Pentest/ações ofensivas somente em sistemas próprios ou explicitamente autorizados.
- Peça aprovação antes de ações destrutivas, migrações irreversíveis, alteração de dados reais, publicação externa, compras ou ampliação material de escopo.
- Registre achados relevantes como GitHub Issues verificáveis e priorizadas.
- Toda entrega deve informar arquivos alterados, checks executados, riscos restantes, referências utilizadas e próximo passo.

## Continuidade
Novos vídeos, listas, skills e repositórios devem ser classificados em:
1. ferramenta/repositório;
2. skill;
3. padrão obrigatório;
4. recomendação condicional;
5. checklist;
6. referência experimental;
7. item pendente de confirmação.

Conteúdo ambíguo não deve ser inventado. Mantenha evidência e pendências documentadas.
