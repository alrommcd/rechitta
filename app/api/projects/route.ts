import { NextResponse } from 'next/server'
import { fetchAllProjects } from '@/lib/supabase'

export async function GET() {
  try {
    const projects = await fetchAllProjects()
    return NextResponse.json(projects)
  } catch (err) {
    console.error('[Projects] fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}
