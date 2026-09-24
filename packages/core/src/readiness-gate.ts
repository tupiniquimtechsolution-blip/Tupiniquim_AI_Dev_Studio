import {
  engineeringPlaybookSourceSchema,
  readinessCheckSchema,
  readinessReportSchema,
  type EngineeringPlaybookSource,
  type ReadinessCheck,
  type ReadinessReport
} from '@tupiniquim/contracts'

export const buildMw3ReadinessReport = (input: ReadinessCheck[]): ReadinessReport => {
  const checks = input.map((check) => readinessCheckSchema.parse(check))
  const blocked = checks.filter((check) => check.status === 'BLOCKED').map((check) => check.id)
  const windowsDeferred = checks.filter((check) => check.status === 'WINDOWS_DEFERRED').map((check) => check.id)
  const evidenceMissing = checks
    .filter((check) => check.status === 'CLOUD_PASS' && check.evidence.length === 0)
    .map((check) => check.id)
  const allBlocked = [...new Set([...blocked, ...evidenceMissing])]

  return readinessReportSchema.parse({
    wave: 'MW3',
    generatedAt: new Date().toISOString(),
    cloudGreenEligible: allBlocked.length === 0,
    releaseGreenEligible: allBlocked.length === 0 && windowsDeferred.length === 0,
    blocked: allBlocked,
    windowsDeferred,
    checks
  })
}

export const createVibeCodingToolkitPlaybookSource = (sourceRef: string): EngineeringPlaybookSource =>
  engineeringPlaybookSourceSchema.parse({
    name: 'Vibe Coding Toolkit',
    sourceUrl: 'https://github.com/soumatheusgomes/vibe-coding-toolkit',
    sourceRef,
    role: 'ENGINEERING_PLAYBOOK_SOURCE',
    authoritative: false,
    runtimeDependency: false,
    autoInstallAllowed: false,
    adoptedPractices: [
      'brainstorm-before-implementation',
      'explicit-plan-before-code',
      'work-waves-with-file-ownership',
      'review-before-promotion',
      'quality-gates-on-every-change'
    ],
    rejectedOrDeferredPractices: [
      'automatic-plugin-installation',
      'automatic-hook-installation',
      'fixed-350-lines-limit-as-global-requirement',
      'third-party-playbook-overrides-project-policy'
    ]
  })
