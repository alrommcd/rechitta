import { GoogleGenAI } from '@google/genai'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

// Ordered by free-tier daily headroom (highest first).
// flash-lite ≈ 1,000 req/day, flash ≈ 20 req/day on the free tier.
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']

export async function generateAnswer(
  systemPrompt: string,
  messages: AiMessage[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in .env.local')
  }

  const ai = new GoogleGenAI({ apiKey })

  // Gemini uses 'model' instead of 'assistant' for AI turns
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 1500

  let lastError: unknown

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 1024,
          },
        })
        return response.text ?? ''
      } catch (err) {
        lastError = err
        const status = (err as { status?: number })?.status
        const message = (err as { message?: string })?.message ?? ''

        const isDailyCap =
          status === 429 && /PerDay|free_tier_requests/i.test(message)
        const isTransient = status === 503 || status === 429

        // Daily free-tier quota gone for this model — retrying won't help.
        // Jump straight to the next model in the list.
        if (isDailyCap) {
          console.warn(`[Gemini] ${model} daily free-tier quota exhausted — trying next model…`)
          break
        }

        // Real error (bad request, auth, etc.) — no point retrying or falling back.
        if (!isTransient) throw err

        // Per-minute rate limit or server overload — back off and retry same model.
        if (attempt === MAX_RETRIES) {
          console.warn(`[Gemini] ${model} still failing after ${MAX_RETRIES} attempts — trying next model…`)
          break
        }

        console.warn(`[Gemini] ${model} attempt ${attempt} failed (${status}), retrying in ${RETRY_DELAY_MS}ms…`)
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS))
      }
    }
  }

  // Every model + retry exhausted.
  throw lastError ?? new Error('Gemini: all models failed')
}
