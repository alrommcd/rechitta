import { NextResponse } from 'next/server'
import { fetchAllProjects } from '@/lib/supabase'
import { buildSystemPrompt } from '@/lib/systemPrompt'

// Temporary debug endpoint — remove before production
export async function GET() {
  try {
    const projects = await fetchAllProjects()

    const projectNames = projects.map((p) => p.project_name)
    const berkeleyRow = projects.find((p) =>
      p.project_name?.toLowerCase().includes('berkeley')
    )

    const sampleContext = projects.slice(0, 1).map((p) => ({
      project_name: p.project_name,
      units_available: p.units_available,
      starting_price: p.starting_price,
      rental_yield: p.rental_yield,
      service_charge: p.service_charge,
    }))

    return NextResponse.json({
      rowCount: projects.length,
      projectNames,
      berkeleySquareFound: !!berkeleyRow,
      berkeleySquareRow: berkeleyRow ?? null,
      systemPromptLength: buildSystemPrompt('text').length,
      firstRowSample: sampleContext,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        supabaseUrl: process.env.SUPABASE_URL ?? 'NOT SET',
        supabaseKeySet: !!process.env.SUPABASE_ANON_KEY,
      },
      { status: 500 }
    )
  }
}
