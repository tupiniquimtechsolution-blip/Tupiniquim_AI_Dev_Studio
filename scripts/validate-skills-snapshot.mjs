import { readFile } from 'node:fs/promises'

const pinnedId = 'vercel-labs/skills/find-skills'
const allowedViews = new Set(['all-time', 'trending', 'hot'])

const fail = (message) => { throw new Error(`SKILLS_SNAPSHOT_INVALID: ${message}`) }

const validate = (snapshot, file) => {
  if (snapshot === null || typeof snapshot !== 'object') fail(`${file}: root precisa ser objeto.`)
  if (snapshot.source !== 'https://skills.sh') fail(`${file}: source não canônico.`)
  if (snapshot.endpoint !== '/api/v1/skills') fail(`${file}: endpoint não canônico.`)
  if (!allowedViews.has(snapshot.view)) fail(`${file}: view inválida.`)
  if (!Number.isInteger(snapshot.requested) || snapshot.requested < 1 || snapshot.requested > 500) fail(`${file}: requested inválido.`)
  if (!Number.isInteger(snapshot.returned) || snapshot.returned < 1 || snapshot.returned > 500) fail(`${file}: returned inválido.`)
  if (!Array.isArray(snapshot.skills) || snapshot.skills.length !== snapshot.returned) fail(`${file}: skills/returned inconsistentes.`)
  if (!Array.isArray(snapshot.pinned) || !snapshot.pinned.includes(pinnedId)) fail(`${file}: find-skills não está pinned.`)
  const pinned = snapshot.skills.find((skill) => skill?.id === pinnedId)
  if (pinned?.pinned !== true) fail(`${file}: find-skills ausente ou não marcado pinned.`)
  if (snapshot.skills.some((skill, index) => skill?.rank !== index + 1)) fail(`${file}: ranking não é sequencial.`)
}

const files = process.argv.slice(2)
if (files.length === 0) fail('informe ao menos um snapshot JSON.')

for (const file of files) {
  const snapshot = JSON.parse(await readFile(file, 'utf8'))
  validate(snapshot, file)
  console.log(`PASS ${file}: ${snapshot.returned} skills, view=${snapshot.view}, find-skills pinned.`)
}
