import { assign, setup } from 'xstate'
import type { JobState, Mode } from '@tupiniquim/contracts'

export interface WorkflowContext {
  mode: Mode
  state: JobState
  objective: string
  error: string | undefined
}

export type WorkflowEvent =
  | { type: 'SUBMIT'; objective: string; mode: Mode }
  | { type: 'UNDERSTOOD'; needsResearch: boolean }
  | { type: 'RESEARCHED' }
  | { type: 'PLAN_READY' }
  | { type: 'APPROVE' }
  | { type: 'EXECUTED' }
  | { type: 'VALIDATED' }
  | { type: 'REVIEWED' }
  | { type: 'FAIL'; message: string }
  | { type: 'BLOCK' }
  | { type: 'NEED_USER' }
  | { type: 'ROLLBACK' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }

export const workflowMachine = setup({
  types: { context: {} as WorkflowContext, events: {} as WorkflowEvent }
}).createMachine({
  id: 'agent-workflow',
  initial: 'REQUEST',
  context: { mode: 'CHAT', state: 'REQUEST', objective: '', error: undefined },
  on: {
    CANCEL: { target: '.CANCELLED', actions: assign({ state: 'CANCELLED' }) },
    FAIL: { target: '.FAILED', actions: assign({ state: 'FAILED', error: ({ event }) => event.message }) },
    BLOCK: { target: '.BLOCKED', actions: assign({ state: 'BLOCKED' }) },
    NEED_USER: { target: '.NEEDS_USER_INPUT', actions: assign({ state: 'NEEDS_USER_INPUT' }) }
  },
  states: {
    REQUEST: { on: { SUBMIT: { target: 'UNDERSTANDING', actions: assign({ state: 'UNDERSTANDING', objective: ({ event }) => event.objective, mode: ({ event }) => event.mode }) } } },
    UNDERSTANDING: { on: { UNDERSTOOD: [{ guard: ({ event }) => event.needsResearch, target: 'RESEARCH', actions: assign({ state: 'RESEARCH' }) }, { target: 'PLAN', actions: assign({ state: 'PLAN' }) }] } },
    RESEARCH: { on: { RESEARCHED: { target: 'PLAN', actions: assign({ state: 'PLAN' }) } } },
    PLAN: { on: { PLAN_READY: { target: 'WAITING_APPROVAL', actions: assign({ state: 'WAITING_APPROVAL' }) } } },
    WAITING_APPROVAL: { on: { APPROVE: { target: 'EXECUTION', actions: assign({ state: 'EXECUTION' }) } } },
    EXECUTION: { on: { EXECUTED: { target: 'VALIDATION', actions: assign({ state: 'VALIDATION' }) } } },
    VALIDATION: { on: { VALIDATED: { target: 'REVIEW', actions: assign({ state: 'REVIEW' }) }, ROLLBACK: { target: 'ROLLBACK', actions: assign({ state: 'ROLLBACK' }) } } },
    REVIEW: { on: { REVIEWED: { target: 'COMPLETED', actions: assign({ state: 'COMPLETED' }) }, ROLLBACK: { target: 'ROLLBACK', actions: assign({ state: 'ROLLBACK' }) } } },
    COMPLETED: { type: 'final' },
    BLOCKED: { on: { RETRY: { target: 'UNDERSTANDING', actions: assign({ state: 'UNDERSTANDING', error: undefined }) } } },
    FAILED: { on: { RETRY: { target: 'UNDERSTANDING', actions: assign({ state: 'UNDERSTANDING', error: undefined }) }, ROLLBACK: { target: 'ROLLBACK', actions: assign({ state: 'ROLLBACK' }) } } },
    ROLLBACK: { on: { RETRY: { target: 'UNDERSTANDING', actions: assign({ state: 'UNDERSTANDING', error: undefined }) } } },
    CANCELLED: { type: 'final' },
    NEEDS_USER_INPUT: { on: { RETRY: { target: 'UNDERSTANDING', actions: assign({ state: 'UNDERSTANDING' }) } } }
  }
})
