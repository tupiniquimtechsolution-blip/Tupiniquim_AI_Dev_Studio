import { createHash, randomUUID } from 'node:crypto'
import { compiledPromptSchema, promptTemplateSchema, type CompiledPrompt, type PromptComparison, type PromptLintIssue, type PromptTemplate, type PromptVariable } from '@tupiniquim/contracts'

export interface PromptRepository {
  putPrompt(template: PromptTemplate): Promise<void>
  getPrompt(id: string): Promise<PromptTemplate | null>
  listPrompts(): Promise<PromptTemplate[]>
  recordPromptUsage(executionId: string, templateId: string, promptHash: string): Promise<void>
}

export class PromptArchitect {
  public constructor(private readonly repository: PromptRepository) {}

  public async save(name: string, content: string, variables: PromptVariable[]): Promise<PromptTemplate> {
    const current = await this.repository.listPrompts()
    const version = Math.max(0, ...current.filter((template) => template.name === name).map((template) => template.version)) + 1
    const now = new Date().toISOString()
    const template = promptTemplateSchema.parse({ id: randomUUID(), name, version, content, variables, createdAt: now, updatedAt: now })
    await this.repository.putPrompt(template)
    return template
  }

  public async list(): Promise<PromptTemplate[]> { return await this.repository.listPrompts() }

  public async compile(templateId: string, values: Record<string, string>, executionId?: string): Promise<CompiledPrompt> {
    const template = await this.requireTemplate(templateId)
    const declared = new Set(template.variables.map((variable) => variable.name))
    const unknown = Object.keys(values).filter((name) => !declared.has(name))
    if (unknown.length > 0) throw new Error(`Variáveis não declaradas: ${unknown.join(', ')}.`)
    let content = template.content
    for (const variable of template.variables) {
      const value = values[variable.name] ?? variable.defaultValue
      if (variable.required && (value === undefined || value === '')) throw new Error(`Variável obrigatória ausente: ${variable.name}.`)
      content = content.replaceAll(`{{${variable.name}}}`, value ?? '')
    }
    const lint = this.lint(content)
    const compiled = compiledPromptSchema.parse({ templateId, version: template.version, content, hash: createHash('sha256').update(content).digest('hex'), compiledAt: new Date().toISOString(), lint })
    if (executionId !== undefined) await this.repository.recordPromptUsage(executionId, templateId, compiled.hash)
    return compiled
  }

  public lint(content: string): PromptLintIssue[] {
    const issues: PromptLintIssue[] = []
    if (/\{\{[a-zA-Z][a-zA-Z0-9_]*\}\}/u.test(content)) issues.push({ severity: 'ERROR', code: 'UNRESOLVED_VARIABLE', message: 'O prompt contém variável não resolvida.' })
    if (/sk-(?:proj-)?[A-Za-z0-9_-]{12,}/u.test(content)) issues.push({ severity: 'ERROR', code: 'POSSIBLE_SECRET', message: 'O prompt parece conter um segredo literal.' })
    if (!/(objetivo|objective|tarefa|task)/iu.test(content)) issues.push({ severity: 'WARNING', code: 'MISSING_OBJECTIVE', message: 'Declare o objetivo de forma explícita.' })
    if (!/(restriç|constraint|não deve|must not)/iu.test(content)) issues.push({ severity: 'WARNING', code: 'MISSING_CONSTRAINTS', message: 'Declare limites e restrições.' })
    if (!/(aceite|acceptance|valida|test)/iu.test(content)) issues.push({ severity: 'WARNING', code: 'MISSING_ACCEPTANCE', message: 'Inclua critérios de aceite ou validação.' })
    if (content.length > 50_000) issues.push({ severity: 'INFO', code: 'VERY_LONG', message: 'Prompt longo; considere referências ou composição por blocos.' })
    return issues
  }

  public async compare(leftId: string, rightId: string): Promise<PromptComparison> {
    const [left, right] = await Promise.all([this.requireTemplate(leftId), this.requireTemplate(rightId)])
    const leftLines = new Set(left.content.split(/\r?\n/u))
    const rightLines = new Set(right.content.split(/\r?\n/u))
    return { left, right, added: [...rightLines].filter((line) => !leftLines.has(line)), removed: [...leftLines].filter((line) => !rightLines.has(line)) }
  }

  public async export(templateId: string): Promise<string> {
    const template = await this.requireTemplate(templateId)
    return [`# ${template.name}`, '', `Versão: ${template.version}`, '', '## Variáveis', '', ...template.variables.map((variable) => `- \`${variable.name}\`: ${variable.description}${variable.required ? ' (obrigatória)' : ''}`), '', '## Template', '', '```text', template.content, '```', ''].join('\n')
  }

  private async requireTemplate(id: string): Promise<PromptTemplate> {
    const template = await this.repository.getPrompt(id)
    if (template === null) throw new Error('Template de prompt não encontrado.')
    return template
  }
}
