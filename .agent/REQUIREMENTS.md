# Requisitos

## Funcionais

- RF-01: criar e abrir projetos em workspaces autorizados.
- RF-02: mapear, buscar, ler, criar e editar arquivos com gravação atômica e diffs.
- RF-03: executar terminais PTY reais com múltiplas sessões, cancelamento e timeout.
- RF-04: inspecionar Git e criar commits, checkpoints e restaurações seguras.
- RF-05: integrar provedores de IA por `AIProvider`, começando pelo Codex App Server.
- RF-06: suportar CHAT, PLAN, RESEARCH, EXECUTE, REVIEW, DEBUG, PROMPT e VISUAL.
- RF-07: persistir planos, passos, execuções, aprovações, eventos, testes e auditoria.
- RF-08: aplicar perfis SAFE, ASSISTED, AUTONOMOUS e FULL_ACCESS.
- RF-09: executar pesquisa HTTP-first e browser-second, preservando fontes e confiança.
- RF-10: gerar recomendações tecnológicas explicáveis para WEB, DESKTOP e MOBILE.
- RF-11: compilar, versionar, comparar, validar e exportar prompts.
- RF-12: pesquisar/transformar assets por adapters visuais e controlar licenças.
- RF-13: personalizar tema, densidade, atalhos e perfis de layout.
- RF-14: supervisionar previews locais isolados e viewport responsivo.
- RF-15: executar testes, apresentar evidências e recuperar falhas.

## Não funcionais

- RNF-01: todo artefato controlável permanece em `D:\CODEX`.
- RNF-02: renderer sem Node, sandbox ativo, CSP restritiva e IPC allowlisted.
- RNF-03: operações privilegiadas exigem schema, política, cancelamento e auditoria.
- RNF-04: segredos nunca aparecem em banco, logs, prompts, Git ou mensagens de erro.
- RNF-05: dados permanecem utilizáveis offline, exceto funções explicitamente de rede.
- RNF-06: toda falha externa gera estado claro, tentativa recuperável e evidência sanitizada.
- RNF-07: contraste WCAG AA, navegação por teclado e movimento reduzido.
- RNF-08: migrações do banco são transacionais e precedidas por backup.
- RNF-09: nenhum asset com direitos desconhecidos pode ser marcado para produção.

## Critérios de aceite V1

1. Aplicativo empacotado abre sem acesso privilegiado no renderer.
2. Workspace real completa criar/editar/diff/salvar/buscar com proteção de caminho.
3. Terminal e Git reais funcionam ou reportam bloqueio verificável, nunca simulação.
4. Codex conecta por app-server, transmite eventos e encaminha aprovações.
5. Um plano aprovado executa passos e produz validação, review e checkpoint.
6. Pesquisa produz fontes, confiança, origem e Knowledge Pack.
7. Prompt Architect e Technology Resolution Engine são utilizáveis.
8. Visual Lab bloqueia assets desconhecidos e mantém atribuição/licença.
9. Layout, tema, preview e histórico sobrevivem ao reinício.
10. `pnpm validate` e o dogfood A–K passam.
