import path from 'node:path'

/**
 * Wave 16 — Incremento 4/4 (CORREÇÃO DA AUDITORIA EXTERNA — Bloqueio 3):
 * resolução do dataRoot com override ESTRITAMENTE test-only.
 *
 * Produção normal usa EXATAMENTE o dataRoot operacional canônico:
 *
 *   F:\CODEX\Tupiniquim-AI-Dev-Studio.data
 *
 * O override existe para o gate E2E automatizado (Playwright na máquina
 * Windows F:), que precisa de um dataRoot TEMPORÁRIO E ISOLADO — nunca o
 * dataRoot operacional real, onde o teste gravaria sessions/turns/proposals/
 * AuditLog sem removê-los depois.
 *
 * Contrato de segurança:
 * - o override só é ativado com o par EXPLÍCITO de variáveis de ambiente
 *   `TUPINIQUIM_E2E=1` + `TUPINIQUIM_E2E_DATA_ROOT=<path>`;
 * - sem o flag, um `TUPINIQUIM_E2E_DATA_ROOT` avulso é IGNORADO (produção
 *   segue no root operacional);
 * - COM o flag ativo, um path ausente/relativo/fora do volume autorizado F:\ é
 *   RECUSADO com erro explícito (fail-loud) — nunca cai silenciosamente no
 *   dataRoot operacional, porque o propósito do modo é isolamento;
 * - não há setter via IPC e o renderer jamais influencia o resultado: a
 *   resolução acontece uma única vez no boot do processo main, a partir de
 *   `process.env`.
 */

export const productionDataRoot = 'F:\\CODEX\\Tupiniquim-AI-Dev-Studio.data'

export const e2eDataRootModeEnv = 'TUPINIQUIM_E2E'
export const e2eDataRootPathEnv = 'TUPINIQUIM_E2E_DATA_ROOT'

export type DataRootEnvironment = Partial<Record<string, string | undefined>>

export const resolveDataRoot = (env: DataRootEnvironment): string => {
  if (env[e2eDataRootModeEnv] !== '1') return productionDataRoot
  const candidate = env[e2eDataRootPathEnv]
  if (candidate === undefined || candidate === '') {
    throw new Error('Modo E2E ativo (TUPINIQUIM_E2E=1) exige TUPINIQUIM_E2E_DATA_ROOT explícito e isolado; recusado usar o dataRoot operacional.')
  }
  // O path precisa ser absoluto no formato Windows e estar no volume
  // autorizado F: (o gate E2E real roda somente na máquina Windows F:).
  if (!path.win32.isAbsolute(candidate) || path.win32.parse(candidate).root.toUpperCase() !== 'F:\\') {
    throw new Error('TUPINIQUIM_E2E_DATA_ROOT precisa ser um caminho absoluto dentro do volume autorizado F:.')
  }
  return candidate
}
