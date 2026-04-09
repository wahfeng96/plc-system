import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// GET: list auth users (id, email, user_metadata)
export async function GET() {
  const sb = getAdmin()
  if (!sb) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const { data, error } = await sb.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    data.users.map(u => ({
      id: u.id,
      email: u.email,
      user_metadata: u.user_metadata || {},
      plain_password: (u.user_metadata as Record<string, unknown>)?.plain_password || '',
    }))
  )
}

// POST: create a new user (admin creates account for teacher/guard)
export async function POST(req: NextRequest) {
  const sb = getAdmin()
  if (!sb) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const { email, password, role, display_name } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const userRole = role || 'teacher'

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: userRole, display_name: display_name || null, plain_password: password },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, userId: data.user.id })
}

// PATCH: update user metadata (role, display_name, allowed_pages, teacher_id)
export async function PATCH(req: NextRequest) {
  const sb = getAdmin()
  if (!sb) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const { userId, role, display_name, allowed_pages, teacher_id, password } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const metadata: Record<string, unknown> = {}
  if (role !== undefined) metadata.role = role
  if (display_name !== undefined) metadata.display_name = display_name
  if (allowed_pages !== undefined) metadata.allowed_pages = allowed_pages
  if (teacher_id !== undefined) metadata.teacher_id = teacher_id
  if (password) metadata.plain_password = password

  const updatePayload: Record<string, unknown> = { user_metadata: metadata }
  if (password) updatePayload.password = password

  const { error } = await sb.auth.admin.updateUserById(userId, updatePayload)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE: delete auth user
export async function DELETE(req: NextRequest) {
  const sb = getAdmin()
  if (!sb) return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const { error } = await sb.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
