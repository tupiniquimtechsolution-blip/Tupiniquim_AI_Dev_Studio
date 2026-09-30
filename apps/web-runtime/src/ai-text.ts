/**
 * Normalização das respostas do Workers AI para texto de conversa.
 *
 * Formatos suportados (nesta ordem):
 * 1. string direta;
 * 2. `{ response: string }` (formato clássico Workers AI);
 * 3. `{ result: string }` e `{ result: { response: string } }` (envelopes REST);
 * 4. OpenAI-compatible: `{ choices: [{ message: { content } }] }` — também
 *    aceita `choices[0].delta.content` (chunk de stream) e `choices[0].text`
 *    (completions), inclusive aninhado em `result`.
 *
 * Regras de segurança de apresentação:
 * - somente `content` textual chega ao renderer;
 * - `reasoning_content`, `usage`, `model` e demais metadados NUNCA são
 *   renderizados como mensagem;
 * - payload OpenAI-shaped sem texto útil vira string vazia (nunca o objeto
 *   bruto, que conteria reasoning/usage);
 * - fallback `JSON.stringify` permanece apenas para formatos realmente
 *   desconhecidos (compatibilidade com o comportamento anterior).
 */

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord => value !== null && typeof value === 'object'

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

const firstChoiceText = (choices: unknown): string | null => {
  if (!Array.isArray(choices) || choices.length === 0) return null
  const choice = choices[0]
  if (!isRecord(choice)) return null
  if (isRecord(choice.message)) {
    const content = nonEmpty(choice.message.content)
    if (content !== null) return content
  }
  if (isRecord(choice.delta)) {
    const content = nonEmpty(choice.delta.content)
    if (content !== null) return content
  }
  return nonEmpty(choice.text)
}

export const aiText = (response: unknown): string => {
  if (typeof response === 'string') return response
  if (isRecord(response)) {
    if (typeof response.response === 'string') return response.response
    if (typeof response.result === 'string') return response.result
    if (isRecord(response.result)) {
      const nested = response.result
      if (typeof nested.response === 'string') return nested.response
      const nestedChoice = firstChoiceText(nested.choices)
      if (nestedChoice !== null) return nestedChoice
      if (Array.isArray(nested.choices)) return ''
    }
    const choice = firstChoiceText(response.choices)
    if (choice !== null) return choice
    // OpenAI-shaped sem texto: falha silenciosa segura — nunca vazar
    // reasoning_content/usage/model como mensagem.
    if (Array.isArray(response.choices)) return ''
  }
  return JSON.stringify(response)
}
