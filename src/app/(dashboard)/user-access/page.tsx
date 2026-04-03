'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Shield, Pencil, Search } from 'lucide-react'

interface UserProfile {
  id: string
  role: string
  display_name: string | null
  email: string | null
  allowed_pages: string[] | null
  created_at: string
}

const ALL_PAGES = [
  { href: '/dashboard', label: 'Dashboard', forRoles: ['admin', 'teacher'] },
  { href: '/timetable', label: 'Timetable', forRoles: ['admin'] },
  { href: '/teachers', label: 'Teachers', forRoles: ['admin'] },
  { href: '/students', label: 'Students', forRoles: ['admin'] },
  { href: '/rooms', label: 'Rooms', forRoles: ['admin'] },
  { href: '/attendance', label: 'Attendance', forRoles: ['admin'] },
  { href: '/invoices', label: 'Invoices', forRoles: ['admin'] },
  { href: '/holidays', label: 'Holidays', forRoles: ['admin'] },
  { href: '/my-schedule', label: 'My Schedule', forRoles: ['teacher'] },
  { href: '/take-attendance', label: 'Take Attendance', forRoles: ['teacher'] },
  { href: '/my-students', label: 'My Students', forRoles: ['teacher'] },
  { href: '/my-rental', label: 'My Rental', forRoles: ['teacher'] },
  { href: '/guard', label: "Today's Schedule", forRoles: ['guard'] },
]

export default function UserAccessPage() {
  const { role } = useAuth()
  const supabase = createClient()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState<UserProfile | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editName, setEditName] = useState('')
  const [editPages, setEditPages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (role !== 'admin') {
    return <div className="text-center py-12 text-gray-500">Admin access only</div>
  }

  function openEdit(user: UserProfile) {
    setEditUser(user)
    setEditRole(user.role)
    setEditName(user.display_name || user.email || '')
    setEditPages(user.allowed_pages || [])
  }

  async function saveUser() {
    if (!editUser) return
    setSaving(true)

    await supabase.from('profiles').update({
      role: editRole,
      display_name: editName || null,
      allowed_pages: editPages.length > 0 ? editPages : null,
    }).eq('id', editUser.id)

    setSaving(false)
    setEditUser(null)
    load()
  }

  function togglePage(href: string) {
    setEditPages(prev =>
      prev.includes(href) ? prev.filter(p => p !== href) : [...prev, href]
    )
  }

  function selectAllPages() {
    const rolePages = ALL_PAGES.filter(p => p.forRoles.includes(editRole)).map(p => p.href)
    setEditPages(rolePages)
  }

  function clearAllPages() {
    setEditPages([])
  }

  const filteredUsers = search
    ? users.filter(u =>
        (u.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
      )
    : users

  const roleBadge = (r: string) => {
    if (r === 'admin') return <Badge className="bg-blue-100 text-blue-700">Admin</Badge>
    if (r === 'teacher') return <Badge className="bg-green-100 text-green-700">Teacher</Badge>
    if (r === 'guard') return <Badge className="bg-yellow-100 text-yellow-700">Guard</Badge>
    return <Badge variant="secondary">{r}</Badge>
  }

  if (loading) return <div className="py-12 text-center text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">User Access</h1>
        <Badge variant="secondary" className="ml-auto">{users.length} users</Badge>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, email or role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filteredUsers.map(user => (
          <Card key={user.id} className="hover:ring-1 hover:ring-blue-200 transition-all">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {user.display_name || user.email || user.id.slice(0, 8)}
                    </span>
                    {roleBadge(user.role)}
                  </div>
                  {user.email && (
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  )}
                  {user.allowed_pages && user.allowed_pages.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {user.allowed_pages.map(p => (
                        <span key={p} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {ALL_PAGES.find(ap => ap.href === p)?.label || p}
                        </span>
                      ))}
                    </div>
                  )}
                  {(!user.allowed_pages || user.allowed_pages.length === 0) && (
                    <p className="text-[10px] text-gray-400 mt-1">All pages (role default)</p>
                  )}
                </div>
                <button
                  onClick={() => openEdit(user)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-2"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Access</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              {/* Display Name */}
              <div className="space-y-1">
                <Label className="text-sm">Display Name</Label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Enter name..."
                />
              </div>

              {/* Role */}
              <div className="space-y-1">
                <Label className="text-sm">Role</Label>
                <select
                  value={editRole}
                  onChange={e => { setEditRole(e.target.value); setEditPages([]) }}
                  className="w-full h-9 rounded-lg border border-input bg-white px-3 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="guard">Guard</option>
                </select>
              </div>

              {/* Page Access */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Page Access</Label>
                  <div className="flex gap-2">
                    <button onClick={selectAllPages} className="text-xs text-blue-600 hover:underline">All</button>
                    <span className="text-xs text-gray-300">|</span>
                    <button onClick={clearAllPages} className="text-xs text-gray-500 hover:underline">None (default)</button>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Leave empty = all pages for this role. Select specific pages to restrict access.
                </p>
                <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
                  {ALL_PAGES.filter(p => p.forRoles.includes(editRole)).map(page => {
                    const checked = editPages.includes(page.href)
                    return (
                      <label key={page.href} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-white cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePage(page.href)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {page.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Save */}
              <Button
                onClick={saveUser}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
