import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// ── Voice constants — change these to tune the voice ─────────────────────────
const TTS_MODEL  = 'gemini-2.5-flash-preview-tts'
const VOICE_NAME = 'Aoede'   // warm, sophisticated female; alternatives: 'Kore', 'Zephyr'
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps raw PCM (L16, signed 16-bit little-endian, mono) in a standard WAV
 * container so browsers can play it via <audio> or AudioContext.
 */
function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate   = (sampleRate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const header     = Buffer.allocUnsafe(44)

  header.write('RIFF',  0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE',  8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)            // PCM sub-chunk size
  header.writeUInt16LE(1,  20)            // PCM format (linear)
  header.writeUInt16LE(channels,   22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate,   28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)

  return Buffer.concat([header, pcm])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { text?: string }
    const text = body.text?.trim()
    if (!text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: VOICE_NAME },
          },
        },
      },
    })

    const part         = response.candidates?.[0]?.content?.parts?.[0]
    const base64Audio  = part?.inlineData?.data
    const mimeType     = part?.inlineData?.mimeType ?? 'audio/l16'

    if (!base64Audio) {
      console.error('[TTS] Gemini returned no audio. Response:', JSON.stringify(response.candidates?.[0]))
      return NextResponse.json({ error: 'no audio in Gemini response' }, { status: 500 })
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64')

    // Gemini TTS returns raw PCM (audio/l16 at 24 kHz, 16-bit, mono).
    // Detect and wrap; if Gemini ever returns audio/wav or mp3 directly, pass through.
    const isRawPcm      = /audio\/l16|audio\/pcm|audio\/raw/i.test(mimeType)
    const rateMatch     = mimeType.match(/rate=(\d+)/i)
    const sampleRate    = rateMatch ? parseInt(rateMatch[1]) : 24000

    const outBuffer     = isRawPcm ? pcmToWav(audioBuffer, sampleRate, 1, 16) : audioBuffer
    const outMime       = isRawPcm ? 'audio/wav' : mimeType

    // Next.js 16 NextResponse body must be BodyInit — convert Node Buffer to Uint8Array
    return new NextResponse(new Uint8Array(outBuffer), {
      headers: {
        'Content-Type':  outMime,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[TTS] route error:', err)
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 })
  }
}
