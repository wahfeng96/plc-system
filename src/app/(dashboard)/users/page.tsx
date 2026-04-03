'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Teacher } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search, CheckCircle, XCircle, Trash2, Pencil } from 'lucide-react'

interface AuthUser {
  id: string
  email: string
  user_metadata: Record<string, unknown>
}

interface UserProfile {
  id: string
  role: string
  created_at: string
  email?: string
  display_name?: string
  allowed_pages?: string[]
  teacher_id?: string
}

const ROLE_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  admin: { variant: 'default', label: 'Admin' },
  teacher: { variant: 'secondary', label: 'Teacher' },
  guard: { variant: 'outline', label: 'Guard' },
  pending: { variant: 'destructive', label: 'Pending' },
}

const ALL_PAGES = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/timetable', label: 'Timetable' },
  { href: '/teachers', label: 'Teachers' },
  { href: '/students', label: 'Students' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/attendance', label: 'Attendance' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/holidays', label: 'Holidays' },
]

export default function UsersPage() {
  const { role } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<UserProfile | null>(null)
  const [editRole, setEditRole] = useState('teacher')
  const [editName, setEditName] = useState('')
  const [editPages, setEditPages] = useState<string[]>([])
  const [editTeacherId, setEditTeacherId] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<UserProfile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const [profilesRes, teachersRes] = await Promise.all([
      supabase.from('profiles').select('id, role, created_at').order('created_at', { ascending: false }),
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
    ])

    const profiles = profilesRes.data || []
    setTeachers(teachersRes.data || [])

    // Get full auth user data (emails + metadata)
    const res = await fetch('/api/users')
    const authUsers: AuthUser[] = res.ok ? await res.json() : []
    const authMap = new Map(authUsers.map(u => [u.id, u]))

    setUsers(profiles.map(p => {
      const au = authMap.get(p.id)
      return {
        ...p,
        email: au?.email || '—',
        display_name: (au?.user_metadata?.display_name as string) || '',
        allowed_pages: (au?.user_metadata?.allowed_pages as string[]) || [],
        teacher_id: (au?.user_metadata?.teacher_id as string) || '',
      }
    }))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openEdit(user: UserProfile) {
    setEditUser(user)
    setEditRole(user.role)
    setEditName(user.display_name || '')
    setEditPages(user.allowed_pages || [])
    setEditTeacherId(user.teacher_id || '')
  }

  function togglePage(href: string) {
    setEditPages(prev =>
      prev.includes(href) ? prev.filter(p => p !== href) : [...prev, href]
    )
  }

  async function handleSave() {
    if (!editUser) return
    setSaving(true)

    // Update profile role in DB
    await supabase.from('profiles').update({ role: editRole }).eq('id', editUser.id)

    // Update auth user metadata (role + display_name + allowed_pages + teacher_id)
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: editUser.id,
        role: editRole,
        display_name: editName || null,
        allowed_pages: editPages.length > 0 ? editPages : null,
        teacher_id: editTeacherId || null,
      }),
    })

    // If teacher_id selected, link teacher record
    if (editTeacherId && editRole === 'teacher') {
      await supabase.from('teachers').update({ user_id: editUser.id }).eq('id', editTeacherId)
    }

    setSaving(false)
    setEditUser(null)
    load()
  }

  async function quickApprove(user: UserProfile) {
    setSaving(true)
    await supabase.from('profiles').update({ role: 'teacher' }).eq('id', user.id)
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, role: 'teacher' }),
    })
    setSaving(false)
    load()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    await supabase.from('profiles').delete().eq('id', deleteConfirm.id)
    await fetch('/api/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: deleteConfirm.id }),
    })
    setDeleting(false)
    setDeleteConfirm(null)
    load()
  }

  if (role !== 'admin') {
    return <div className="py-12 text-center text-gray-500">Admin access only</div>
  }

  const filtered = users.filter(u =>
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const pendingCount = users.filter(u => u.role === 'pending').length

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-orange-600 mt-1">
              ⚠️ {pendingCount} user{pendingCount > 1 ? 's' : ''} waiting for approval
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Page Access</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="w-44">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => {
                const badge = ROLE_BADGES[u.role] || ROLE_BADGES.pending
                return (
                  <TableRow key={u.id} className={u.role === 'pending' ? 'bg-orange-50' : ''}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{u.email}</span>
                        {u.display_name && (
                          <div className="text-xs text-gray-500">{u.display_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.allowed_pages && u.allowed_pages.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.allowed_pages.map(p => (
                            <Badge key={p} variant="outline" className="text-[10px] px-1 py-0">
                              {ALL_PAGES.find(ap => ap.href === p)?.label || p}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">All (default)</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {u.role === 'pending' ? (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs" onClick={() => quickApprove(u)} disabled={saving}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => openEdit(u)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" className="text-xs" onClick={() => setDeleteConfirm(u)}>
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        ) : u.role !== 'admin' ? (
                          <>
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => openEdit(u)}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(u)} title="Delete">
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Owner</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">No users found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-500 mb-1">{editUser?.email}</div>

          <div className="space-y-5">
            {/* Display Name */}
            <div className="space-y-1">
              <Label>Display Name</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="e.g. Mr. Chen Wei Liang"
              />
            </div>

            {/* Role */}
            <div className="space-y-1">
              <Label>Role</Label>
              <select
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              >
                <option value="teacher">Teacher</option>
                <option value="guard">Guard</option>
                <option value="pending">Pending (revoke access)</option>
              </select>
            </div>

            {/* Link to Teacher Record */}
            {editRole === 'teacher' && (
              <div className="space-y-1">
                <Label>Link to Teacher Record</Label>
                <select
                  value={editTeacherId}
                  onChange={e => setEditTeacherId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">— Not linked —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400">Link this login account to a teacher record so they see their own classes.</p>
              </div>
            )}

            {/* Page Access */}
            <div className="space-y-2">
              <Label>Page Access</Label>
              <p className="text-[11px] text-gray-400">Select which pages this user can see. Leave all unchecked = full access (role default).</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_PAGES.map(page => (
                  <label key={page.href} className="flex items-center gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={editPages.includes(page.href)}
                      onChange={() => togglePage(page.href)}
                      className="rounded"
                    />
                    {page.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm?.email}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
