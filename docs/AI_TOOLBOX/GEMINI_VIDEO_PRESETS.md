# Gemini — Video Prompt Presets

Atualizado em 2026-09-04 a partir do vídeo enviado pelo usuário.

## Importante

Os aliases abaixo são **macros internas do Tupiniquim**. Não há base para tratá-los como comandos oficiais/documentados do Gemini. A barra é uma convenção de UX: o resolver transforma o alias em um prompt estruturado.

O vídeo mostrou três aliases verificáveis:

| Alias | Intenção |
|---|---|
| `/reveal` | product reveal / apresentação cinematográfica do objeto |
| `/teardown` | desmontagem progressiva mostrando componentes |
| `/explodedview` | vista explodida com peças separadas preservando relação espacial |

O CTA do vídeo fala em “mais de 100 comandos”, mas a lista completa não aparece no material recebido. Portanto, o projeto registra somente os três vistos, sem inventar os demais.

## Regras de qualidade

Todos os presets devem:
- preservar identidade, proporções, cores, marca e detalhes visíveis da referência quando solicitado;
- não inventar componentes internos como fato técnico; quando a referência não comprovar o interior, tratar como visual conceitual;
- evitar texto/logos novos;
- manter continuidade temporal e física coerente;
- permitir duração, proporção, câmera e fundo como overrides futuros;
- registrar provenance quando uma geração real for integrada.

## Expansões

### /reveal

“Create a short cinematic product reveal video from the provided reference. Preserve the product identity and proportions. Start with a restrained partial view, then reveal the full subject using controlled camera motion and studio lighting. Keep the background clean, motion smooth and physically plausible. Do not alter labels, branding or visible product details.”

### /teardown

“Create a short technical teardown animation from the provided reference. Preserve the exterior identity. Progressively disassemble the subject into major components in a readable order, with smooth controlled motion and stable camera framing. If internal parts are not evidenced by the reference, present them as conceptual rather than factual. Do not invent labels or brand changes.”

### /explodedview

“Create a short exploded-view animation from the provided reference. Separate the major components along clear spatial axes while preserving their relative assembly positions. Use clean technical/studio lighting, smooth motion and a stable perspective. If internals are not evidenced, keep the visualization conceptual. Do not add unsupported components, text or logos.”

## Runtime

`packages/core/src/gemini-video-presets.ts` contém o catálogo e o resolver puro. O módulo não faz rede e não representa um Gemini provider. A integração real de vídeo fica para o MediaProvider/AIProvider da Wave 5.
