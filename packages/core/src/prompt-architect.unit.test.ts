import { describe, expect, it } from 'vitest'
import type { PromptTemplate } from '@tupiniquim/contracts'
import { PromptArchitect, type PromptRepository } from './prompt-architect'

class MemoryPrompts implements PromptRepository {
  public templates: PromptTemplate[] = []
  public putPrompt(template: PromptTemplate): Promise<void> { this.templates.push(template); return Promise.resolve() }
  public getPrompt(id: string): Promise<PromptTemplate | null> { return Promise.resolve(this.templates.find((template) => template.id === id) ?? null) }
  public listPrompts(): Promise<PromptTemplate[]> { return Promise.resolve(this.templates) }
  public recordPromptUsage(): Promise<void> { return Promise.resolve() }
}

describe('PromptArchitect', () => {
  it('versiona, compila estritamente e produz hash rastreável', async () => {
    const architect = new PromptArchitect(new MemoryPrompts())
    const template = await architect.save('Implementação', 'Objetivo: {{objective}}\nRestrições: não alterar fora do escopo.\nValide com testes.', [{ name: 'objective', description: 'Objetivo', required: true }])
    const compiled = await architect.compile(template.id, { objective: 'Criar recurso' })
    expect(compiled.content).toContain('Criar recurso')
    expect(compiled.hash).toMatch(/^[a-f0-9]{64}$/u)
    expect(compiled.lint).toEqual([])
  })

  it('bloqueia variável ausente e detecta possível segredo', async () => {
    const architect = new PromptArchitect(new MemoryPrompts())
    const template = await architect.save('Teste', '{{required}}', [{ name: 'required', description: 'Obrigatória', required: true }])
    await expect(architect.compile(template.id, {})).rejects.toThrow('obrigatória')
    expect(architect.lint('Objetivo: usar sk-proj-abcdefghijklmnopqrstuv')).toContainEqual(expect.objectContaining({ code: 'POSSIBLE_SECRET', severity: 'ERROR' }))
  })
})
