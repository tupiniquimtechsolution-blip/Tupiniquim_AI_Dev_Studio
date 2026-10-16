import type { ProposalStatus, WorkspaceWriteProposal } from '@tupiniquim/contracts'

/**
 * Cartão de proveniência de proposta workspace.write — compartilhado entre a
 * superfície Desktop (App.tsx) e a superfície Web chat-first (StudioShell).
 */
export const ProposalProvenance = ({ proposal, status, expired }: { proposal: WorkspaceWriteProposal; status: ProposalStatus; expired?: boolean }): React.JSX.Element => (
  <section className={`proposal-provenance${expired === true ? ' expired' : ''}`} aria-label="Proveniência da proposta de escrita">
    <header><strong>workspace.write</strong><span>{status}</span></header>
    <dl>
      <div><dt>Provider</dt><dd>{proposal.provider}</dd></div>
      <div><dt>Tool</dt><dd>{proposal.tool}</dd></div>
      <div><dt>Execution</dt><dd title={proposal.executionId}>{proposal.executionId}</dd></div>
      <div><dt>Step</dt><dd title={proposal.stepId}>{proposal.stepId}</dd></div>
      <div><dt>Thread</dt><dd title={proposal.threadId}>{proposal.threadId}</dd></div>
      <div><dt>Turn</dt><dd title={proposal.turnId}>{proposal.turnId}</dd></div>
      <div><dt>Tool call</dt><dd title={proposal.toolCallId}>{proposal.toolCallId}</dd></div>
      <div><dt>Target</dt><dd title={proposal.effect.target}>{proposal.effect.target}</dd></div>
      <div><dt>Operation</dt><dd>{proposal.effect.operation}</dd></div>
      <div><dt>Manifest</dt><dd title={proposal.effect.id}>{proposal.effect.id}</dd></div>
      <div><dt>Proposal</dt><dd title={proposal.id}>{proposal.id}</dd></div>
      <div><dt>Hash</dt><dd title={proposal.effect.payloadHash}>{proposal.effect.payloadHash}</dd></div>
      <div><dt>Target baseline</dt><dd title={proposal.effect.expectedTargetHash ?? 'INEXISTENTE'}>{proposal.effect.expectedTargetHash ?? 'INEXISTENTE'}</dd></div>
      <div><dt>Timestamp</dt><dd>{new Date(proposal.createdAt).toLocaleString('pt-BR')}</dd></div>
    </dl>
  </section>
)
