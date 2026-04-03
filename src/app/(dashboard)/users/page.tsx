'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
// User roles: admin, teacher, guard, pending
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search, Shield, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react'

interface UserProfile {
  id: string
  role: string
  created_at: string
  email?: string
}

const ROLE_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Shield; label: string }> = {
  admin: { variant: 'default', icon: Shield, label: 'Admin' },
  teacher: { variant: 'secondary', icon: CheckCircle, label: 'Teacher' },
  guard: { variant: 'outline', icon: CheckCircle, label: 'Guard' },
  pending: { variant: 'destructive', icon: Clock, label: 'Pending' },
}

export default function UsersPage() {
  const { role } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<UserProfile | null>(null)
  const [editRole, setEditRole] = useState<string>('teacher')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<UserProfile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, role, created_at')
      .order('created_at', { ascending: false })

    if (!profiles) { setLoading(false); return }

    // Get emails from auth (via service role API route)
    const res = await fetch('/api/users')
    const authUsers: { id: string; email: string }[] = res.ok ? await res.json() : []
    const emailMap = new Map(authUsers.map(u => [u.id, u.email]))

    setUsers(profiles.map(p => ({ ...p, email: emailMap.get(p.id) || '—' })))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openEdit(user: UserProfile) {
    setEditUser(user)
    setEditRole(user.role)
  }

  async function handleApprove(user: UserProfile, newRole: string) {
    setSaving(true)
    // Update profile role
    await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    // Also update auth user metadata
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, role: newRole }),
    })
    setSaving(false)
    setEditUser(null)
    load()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    // Delete profile, then auth user via API
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
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => {
                const badge = ROLE_BADGES[u.role] || ROLE_BADGES.pending
                return (
                  <TableRow key={u.id} className={u.role === 'pending' ? 'bg-orange-50' : ''}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {u.role === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-xs"
                              onClick={() => handleApprove(u, 'teacher')}
                              disabled={saving}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs"
                              onClick={() => setDeleteConfirm(u)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        ) : u.role !== 'admin' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => openEdit(u)}
                            >
                              Change Role
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirm(u)}
                              title="Delete user"
                            >
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
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">No users found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Change Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-3">{editUser?.email}</p>
          <div className="space-y-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => editUser && handleApprove(editUser, editRole)}
              disabled={saving}
            >
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
