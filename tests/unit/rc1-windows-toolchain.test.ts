import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { inspectToolchain, preflight } from '../../scripts/check-windows-toolchain'

const roots: string[] = []
const fixture = (): { root: string; put: (file: string, content?: string) => void } => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rc1-msvc-'))
  roots.push(root)
  const put = (file: string, content = ''): void => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
  return { root, put }
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
it('fails closed without MSBuild and MSVC', () => {
  expect(() => inspectToolchain(fixture().root)).toThrow('REQUIRES_WINDOWS_ENV_FIX')
})
it('detects missing Spectre for the actual default toolset, not another installed version', () => {
  const { root, put } = fixture()
  put('MSBuild/Current/Bin/MSBuild.exe')
  put('VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt', '14.50.12345\r\n')
  put('VC/Tools/MSVC/14.50.12345/bin/Hostx64/x64/cl.exe')
  put('VC/Tools/MSVC/14.40.11111/lib/spectre/x64/libcmt.lib')
  expect(() => inspectToolchain(root)).toThrow(/MSVC 14.50.12345.*prerequisitos ausentes/su)
  put('VC/Tools/MSVC/14.50.12345/lib/spectre/x64/libcmt.lib')
  expect(() => inspectToolchain(root)).toThrow('msvcrt.lib')
  put('VC/Tools/MSVC/14.50.12345/lib/spectre/x64/msvcrt.lib')
  expect(inspectToolchain(root).join('\n')).toContain('Spectre x64:')
})
it('rejects invalid toolset paths and unsupported target architecture', () => {
  const { root, put } = fixture()
  put('MSBuild/Current/Bin/MSBuild.exe')
  put('VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt', '../../other')
  expect(() => inspectToolchain(root)).toThrow('versao MSVC default invalida')
  expect(() => inspectToolchain(root, 'arm64')).toThrow('somente target x64')
})
it.runIf(process.platform !== 'win32')('does not report a Windows PASS on Linux', () => {
  expect(() => preflight()).toThrow('REQUIRES_WINDOWS_GATE')
})
