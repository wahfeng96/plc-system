'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { ClassType } from '@/lib/types'
import { FORM_LEVELS } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Badge removed - not used in card layout
// Table imports removed - using card layout instead
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, BookOpen, Search } from 'lucide-react'

export default function ClassesPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [classes, setClasses] = useState<ClassType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClassType | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<ClassType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    subject: '',
    exam_system: 'SPM',
    form_level: 'Form 4',
  })
  const [examSystems, setExamSystems] = useState<string[]>(['SPM'])
  const supabase = createClient()

  const load = useCallback(async () => {
    const [classRes, examRes] = await Promise.all([
      supabase.from('class_types').select('*').order('form_level').order('subject').order('exam_system'),
      supabase.from('exam_systems').select('name').order('name'),
    ])
    setClasses(classRes.data || [])
    const systems = (examRes.data || []).map((e: { name: string }) => e.name)
    if (systems.length > 0) setExamSystems(systems)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', subject: '', exam_system: 'SPM', form_level: 'Form 4' })
    setDialogOpen(true)
  }

  function openEdit(c: ClassType) {
    setEditing(c)
    setForm({ name: c.name, subject: c.subject, exam_system: c.exam_system, form_level: c.form_level })
    setDialogOpen(true)
  }

  // Auto-generate name from subject + exam + form
  function autoName(subject: string, exam_system: string, form_level: string) {
    if (!subject) return ''
    return `${exam_system} ${subject} ${form_level}`.trim()
  }

  function updateForm(patch: Partial<typeof form>) {
    setForm(f => {
      const next = { ...f, ...patch }
      // Auto-generate name unless user manually edited it
      if (!editing) {
        next.name = autoName(next.subject, next.exam_system, next.form_level)
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim()) {
      alert('Please fill in class name and subject.')
      return
    }
    setSaving(true)

    if (editing) {
      const { error } = await supabase.from('class_types').update({
        name: form.name,
        subject: form.subject,
        exam_system: form.exam_system,
        form_level: form.form_level,
      }).eq('id', editing.id)
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
    } else {
      const { error } = await supabase.from('class_types').insert({
        name: form.name,
        subject: form.subject,
        exam_system: form.exam_system,
        form_level: form.form_level,
      })
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
    }

    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    await supabase.from('class_types').delete().eq('id', deleteConfirm.id)
    setDeleting(false)
    setDeleteConfirm(null)
    load()
  }

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase()) ||
    c.form_level.toLowerCase().includes(search.toLowerCase())
  )

  // Group by form level for nice display
  const groupedByForm = new Map<string, ClassType[]>()
  for (const c of filtered) {
    const arr = groupedByForm.get(c.form_level) || []
    arr.push(c)
    groupedByForm.set(c.form_level, arr)
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Classes</h1>
        {isAdmin && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add Class
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search classes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No classes defined yet.</p>
            {isAdmin && <p className="mt-1">Click <strong>Add Class</strong> to create your first class type.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedByForm.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([formLevel, items]) => (
            <Card key={formLevel}>
              <CardContent className="pt-4 pb-3">
                <h3 className="font-semibold text-sm text-gray-600 mb-3">{formLevel}</h3>
                <div className="space-y-2">
                  {items.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-medium text-sm">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.subject} · {c.exam_system}</div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)} title="Edit">
                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(c)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Class' : 'Add Class'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={e => updateForm({ subject: e.target.value })}
                placeholder="e.g. Add Math, Math, Physics, English"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Exam System</Label>
                <select
                  value={form.exam_system}
                  onChange={e => updateForm({ exam_system: e.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  {examSystems.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Form Level</Label>
                <select
                  value={form.form_level}
                  onChange={e => updateForm({ form_level: e.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  {FORM_LEVELS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Class Name (auto-generated)</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. SPM Add Math Form 4"
              />
              <p className="text-[11px] text-gray-400">This is the display name used everywhere.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
            <DialogTitle>Delete Class</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <strong>{deleteConfirm?.name}</strong>? This won&apos;t affect existing student enrollments.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
