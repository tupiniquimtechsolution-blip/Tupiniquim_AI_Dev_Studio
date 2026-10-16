import { describe, expect, it } from 'vitest'
import { aiText } from '../../apps/web-runtime/src/ai-text'

/**
 * Regressão do bug de produção: o chat renderizava o envelope JSON completo
 * do Workers AI (choices/usage/model/reasoning_content) em vez de somente
 * o texto da mensagem.
 */

// Payload equivalente ao observado em produção (formato OpenAI-compatible).
const openAiPayload = {
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Olá! Como posso ajudar você hoje?',
        reasoning_content: 'O usuário cumprimentou; devo responder cordialmente.'
      },
      finish_reason: 'stop'
    }
  ],
  model: '@cf/zai-org/glm-4.7-flash',
  usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 }
}

describe('aiText — formatos legados preservados', () => {
  it('string direta', () => {
    expect(aiText('resposta direta')).toBe('resposta direta')
  })

  it('{ response: string }', () => {
    expect(aiText({ response: 'texto clássico' })).toBe('texto clássico')
  })

  it('{ result: string }', () => {
    expect(aiText({ result: 'texto no result' })).toBe('texto no result')
  })

  it('{ result: { response: string } }', () => {
    expect(aiText({ result: { response: 'aninhado' } })).toBe('aninhado')
  })
})

describe('aiText — OpenAI-compatible (bug do JSON bruto)', () => {
  it('extrai somente choices[0].message.content', () => {
    expect(aiText(openAiPayload)).toBe('Olá! Como posso ajudar você hoje?')
  })

  it('nunca renderiza reasoning_content, usage, model ou o objeto bruto', () => {
    const text = aiText(openAiPayload)
    expect(text).not.toContain('reasoning_content')
    expect(text).not.toContain('devo responder cordialmente')
    expect(text).not.toContain('usage')
    expect(text).not.toContain('total_tokens')
    expect(text).not.toContain('@cf/zai-org/glm-4.7-flash')
    expect(text).not.toContain('{')
  })

  it('aceita choices[0].delta.content (chunk de stream)', () => {
    expect(aiText({ choices: [{ delta: { content: 'parcial' } }] })).toBe('parcial')
  })

  it('aceita choices[0].text (completions)', () => {
    expect(aiText({ choices: [{ text: 'estilo completions' }] })).toBe('estilo completions')
  })

  it('aceita choices aninhado em result', () => {
    expect(aiText({ result: { choices: [{ message: { content: 'via result' } }] } })).toBe('via result')
  })

  it('payload OpenAI-shaped sem texto útil vira string vazia — nunca vaza o objeto', () => {
    const noContent = { choices: [{ message: { role: 'assistant', content: '', reasoning_content: 'segredo interno' } }], usage: { total_tokens: 3 } }
    expect(aiText(noContent)).toBe('')
    expect(aiText({ result: { choices: [] }, usage: {} })).toBe('')
  })
})

describe('aiText — fallback seguro', () => {
  it('formato realmente desconhecido mantém o fallback JSON.stringify anterior', () => {
    expect(aiText({ inesperado: true })).toBe('{"inesperado":true}')
    expect(aiText(42)).toBe('42')
    expect(aiText(null)).toBe('null')
  })
})
