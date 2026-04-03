'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Teacher } from '@/lib/types'
import { SUBJECTS } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Search, Trash2, ToggleLeft, ToggleRight, Users, Calendar } from 'lucide-react'

const emptyTeacher = { name: '', phone: '', email: '', subjects: [] as string[], status: 'active' as 'active' | 'inactive' }

interface TeacherWithCounts extends Teacher {
  class_count?: number
  student_count?: number
}

export default function TeachersPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [teachers, setTeachers] = useState<TeacherWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState(emptyTeacher)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Teacher | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    const [teachersRes, schedulesRes, studentSubsRes] = await Promise.all([
      supabase.from('teachers').select('*').order('name'),
      supabase.from('schedules').select('teacher_id').eq('status', 'active'),
      supabase.from('student_subjects').select('teacher_id').eq('status', 'active'),
    ])

    const teacherList = teachersRes.data || []
    const schedules = schedulesRes.data || []
    const studentSubs = studentSubsRes.data || []

    // Count classes and students per teacher
    const classCountMap: Record<string, number> = {}
    const studentCountMap: Record<string, Set<string>> = {}

    for (const s of schedules) {
      classCountMap[s.teacher_id] = (classCountMap[s.teacher_id] || 0) + 1
    }
    for (const ss of studentSubs) {
      if (!studentCountMap[ss.teacher_id]) studentCountMap[ss.teacher_id] = new Set()
      studentCountMap[ss.teacher_id].add(ss.teacher_id) // count enrollments
    }

    // Count unique student enrollments
    const studentEnrollCountMap: Record<string, number> = {}
    for (const ss of studentSubs) {
      studentEnrollCountMap[ss.teacher_id] = (studentEnrollCountMap[ss.teacher_id] || 0) + 1
    }

    const enriched: TeacherWithCounts[] = teacherList.map(t => ({
      ...t,
      class_count: classCountMap[t.id] || 0,
      student_count: studentEnrollCountMap[t.id] || 0,
    }))

    setTeachers(enriched)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyTeacher)
    setDialogOpen(true)
  }

  function openEdit(t: Teacher) {
    setEditing(t)
    setForm({ name: t.name, phone: t.phone, email: t.email, subjects: t.subjects, status: t.status })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    if (editing) {
      await supabase.from('teachers').update(form).eq('id', editing.id)
    } else {
      await supabase.from('teachers').insert(form)
    }
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    await supabase.from('teachers').delete().eq('id', deleteConfirm.id)
    setDeleting(false)
    setDeleteConfirm(null)
    load()
  }

  async function toggleStatus(t: Teacher) {
    setToggling(t.id)
    const newStatus = t.status === 'active' ? 'inactive' : 'active'
    await supabase.from('teachers').update({ status: newStatus }).eq('id', t.id)
    setToggling(null)
    load()
  }

  function toggleSubject(sub: string) {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(sub) ? f.subjects.filter(s => s !== sub) : [...f.subjects, sub]
    }))
  }

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Teachers</h1>
        {isAdmin && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add Teacher
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search teachers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead className="hidden md:table-cell">Classes</TableHead>
                <TableHead className="hidden md:table-cell">Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{t.email}</TableCell>
                  <TableCell className="hidden md:table-cell">{t.phone}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.subjects.slice(0, 2).map(s => (
                        <Badge key={s} variant="secondary">{s}</Badge>
                      ))}
                      {t.subjects.length > 2 && (
                        <Badge variant="secondary">+{t.subjects.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3 text-gray-400" /> {t.class_count}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-1 text-sm">
                      <Users className="h-3 w-3 text-gray-400" /> {t.student_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleStatus(t)}
                        disabled={toggling === t.id}
                        title={t.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {t.status === 'active'
                          ? <ToggleRight className="h-4 w-4 text-green-600" />
                          : <ToggleLeft className="h-4 w-4 text-gray-400" />
                        }
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(t)} title="Delete">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                    ) : (
                      <span className="text-xs text-gray-400">View only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    No teachers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Subjects</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(sub => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => toggleSubject(sub)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      form.subjects.includes(sub)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving || !form.name}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Teacher</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Teacher'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
