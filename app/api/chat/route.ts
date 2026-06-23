import { NextRequest, NextResponse } from 'next/server'
import { fetchAllProjects, Project } from '@/lib/supabase'
import { buildSystemPrompt, InputType } from '@/lib/systemPrompt'
import { generateAnswer, AiMessage } from '@/lib/gemini'
import { resolveProject } from '@/lib/fuzzyMatch'

function formatProjectsForContext(projects: Project[]): string {
  if (projects.length === 0) {
    return 'No property data is currently available in the database.'
  }

  return projects.map((p) => {
    const fields: string[] = [`Project: ${p.project_name ?? 'Unknown'}`]
    fields.push(`Developer: ${p.developer ?? 'NULL'}`)
    fields.push(`Status: ${p.status ?? 'NULL'}`)
    fields.push(`Location: ${p.location ?? 'NULL'}`)
    fields.push(`Total Units: ${p.total_units ?? 'NULL'}`)
    fields.push(`Units Available: ${p.units_available ?? 'NULL'}`)
    fields.push(`Starting Price: ${p.starting_price ?? 'NULL'} ${p.price_currency ?? ''}`)
    fields.push(`Area: ${p.area_value ?? 'NULL'} ${p.area_unit ?? ''}`)
    fields.push(`Bedrooms: ${p.bedrooms ?? 'NULL'}`)
    fields.push(`Payment Plan: ${p.payment_plan ?? 'NULL'}`)
    fields.push(`Handover: ${p.handover ?? 'NULL'}`)
    fields.push(`Service Charge: ${p.service_charge ?? 'NULL'}`)
    fields.push(`Rental Yield: ${p.rental_yield ?? 'NULL'}`)
    fields.push(`Notes: ${p.notes ?? 'NULL'}`)
    return fields.join('\n')
  }).join('\n\n---\n\n')
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, inputType = 'text' }: { messages: ChatMessage[]; inputType?: InputType } = body

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    let projects: Project[] = []
    let dataFetchError: string | null = null

    try {
      projects = await fetchAllProjects()
    } catch (err) {
      dataFetchError = err instanceof Error ? err.message : 'Unknown database error'
    }

    console.log('[Supabase] rows returned:', projects.length, '| error:', dataFetchError)

    const dataContext = dataFetchError
      ? `DATABASE ERROR: ${dataFetchError}. You must tell the user you cannot retrieve property data right now.`
      : formatProjectsForContext(projects)

    // Fuzzy-match the user's last message against project names.
    // If the speech-to-text mis-heard the name, this surfaces the correct project
    // for both the data card and an AI disambiguation hint.
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    const fuzzyResult = lastUserMessage
      ? resolveProject(lastUserMessage.content, projects)
      : null

    const matchedProject: Project | null = fuzzyResult?.project ?? null

    // When fuzzy matching resolved a mis-heard name, tell the AI which project
    // the user is most likely asking about, without inventing new information.
    const disambiguationNote =
      fuzzyResult?.wasFuzzy && matchedProject?.project_name
        ? `\nQUERY DISAMBIGUATION: The user's phrasing appears to refer to "${matchedProject.project_name}" — this is the closest project in the database to what they said. Answer about this project if appropriate, but only from the verified data above.\n`
        : ''

    const systemWithData = `${buildSystemPrompt(inputType)}

---
VERIFIED PROPERTY DATABASE (as of this session):

${dataContext}
---
${disambiguationNote}
Answer only from the data above.`

    const aiMessages: AiMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const answer = await generateAnswer(systemWithData, aiMessages)

    return NextResponse.json({ answer, project: matchedProject ?? null })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
