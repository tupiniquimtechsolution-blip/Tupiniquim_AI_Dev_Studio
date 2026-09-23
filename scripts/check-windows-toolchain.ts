import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const remediation = 'Abra Visual Studio Installer > Modificar > Componentes individuais e instale as bibliotecas MSVC x64/x86 com mitigacao Spectre correspondentes ao toolset selecionado. No Windows auditado: Build Tools 18 / VC\\v180 / MSB8040. Nenhuma instalacao/elevacao automatica. O component ID exato nao foi comprovado; nao usar um ID de outro toolset.'

/** Inspect the default toolset of the VS instance node-gyp is expected to select.
 * This is a prerequisite check, not proof that @electron/rebuild/package will succeed. */
export const inspectToolchain = (installationPath: string, arch = 'x64'): string[] => {
  if (arch !== 'x64') throw new Error('REQUIRES_WINDOWS_ENV_FIX: preflight RC1 suporta somente target x64.')
  const msbuild = path.join(installationPath, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe')
  const versionFile = path.join(installationPath, 'VC', 'Auxiliary', 'Build', 'Microsoft.VCToolsVersion.default.txt')
  if (!existsSync(msbuild) || !existsSync(versionFile)) throw new Error(`REQUIRES_WINDOWS_ENV_FIX: MSBuild/MSVC default nao encontrado em ${installationPath}. ${remediation}`)
  const version = readFileSync(versionFile, 'utf8').trim()
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/u.test(version)) throw new Error('REQUIRES_WINDOWS_ENV_FIX: versao MSVC default invalida.')
  const root = path.join(installationPath, 'VC', 'Tools', 'MSVC', version)
  const required = [
    path.join(root, 'bin', 'Hostx64', arch, 'cl.exe'),
    path.join(root, 'lib', 'spectre', arch, 'libcmt.lib'),
    path.join(root, 'lib', 'spectre', arch, 'msvcrt.lib')
  ]
  const missing = required.filter((file) => !existsSync(file))
  if (missing.length > 0) throw new Error(`REQUIRES_WINDOWS_ENV_FIX: MSVC ${version}; prerequisitos ausentes:\n${missing.join('\n')}\n${remediation}`)
  return [`MSBuild: ${msbuild}`, `MSVC: ${version}`, `Spectre ${arch}: ${path.join(root, 'lib', 'spectre', arch)}`]
}

export const preflight = (): void => {
  if (process.platform !== 'win32') throw new Error('REQUIRES_WINDOWS_GATE: package:win requer Windows real e MSVC/Spectre; nenhuma validacao Windows foi executada.')
  // Explicit overrides can make node-gyp choose a different instance/toolset.
  // Do not certify the default instance in that situation.
  if (['GYP_MSVS_VERSION', 'GYP_MSVS_OVERRIDE_PATH', 'npm_config_msvs_version', 'VSINSTALLDIR', 'VCToolsInstallDir', 'VCToolsVersion'].some((key) => process.env[key])) {
    throw new Error('REQUIRES_WINDOWS_ENV_FIX: override MSVC/Developer Prompt detectado. Execute em PowerShell normal para validar o toolset default sem selecao ambigua.')
  }
  const installerRoot = process.env['ProgramFiles(x86)']
  if (!installerRoot) throw new Error(`REQUIRES_WINDOWS_ENV_FIX: Visual Studio Installer nao localizado. ${remediation}`)
  const vswhere = path.join(installerRoot, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
  if (!existsSync(vswhere)) throw new Error(`REQUIRES_WINDOWS_ENV_FIX: vswhere.exe ausente. ${remediation}`)
  const raw = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-format', 'json', '-utf8'], { encoding: 'utf8', timeout: 10_000, windowsHide: true })
  const instances: unknown = JSON.parse(raw.replace(/^\uFEFF/u, ''))
  if (!Array.isArray(instances) || instances.length !== 1) throw new Error(`REQUIRES_WINDOWS_ENV_FIX: nenhuma instancia MSVC x64/x86 identificada por vswhere. ${remediation}`)
  const instance = instances[0] as Record<string, unknown>
  if (typeof instance.installationPath !== 'string' || !path.isAbsolute(instance.installationPath) || instance.isComplete !== true) throw new Error('REQUIRES_WINDOWS_ENV_FIX: instalacao Visual Studio incompleta/invalida.')
  for (const line of inspectToolchain(instance.installationPath, process.arch)) console.log(line)
  console.log('Preflight MSVC/Spectre: PASS (apenas prerequisitos; rebuild nativo permanece obrigatorio).')
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { preflight() } catch (cause) {
    console.error(cause instanceof Error ? cause.message : 'REQUIRES_WINDOWS_ENV_FIX: falha de deteccao MSVC/Spectre.')
    process.exitCode = 1
  }
}
