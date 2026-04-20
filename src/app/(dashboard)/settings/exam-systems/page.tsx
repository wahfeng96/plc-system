'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, GraduationCap } from 'lucide-react'

interface ExamSystem {
  id: string
  name: string
  created_at: string
}

export default function ExamSystemsPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const [items, setItems] = useState<ExamSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ExamSystem | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<ExamSystem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('exam_systems')
      .select('*')
      .order('name')
    setItems(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setName('')
    setDialogOpen(true)
  }

  function openEdit(item: ExamSystem) {
    setEditing(item)
    setName(item.name)
    setDialogOpen(true)
  }

  async function handleSave() {
    const trimmed = name.trim().toUpperCase()
    if (!trimmed) {
      alert('Please enter a name.')
      return
    }
    setSaving(true)

    if (editing) {
      const { error } = await supabase
        .from('exam_systems')
        .update({ name: trimmed })
        .eq('id', editing.id)
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
    } else {
      const { error } = await supabase
        .from('exam_systems')
        .insert({ name: trimmed })
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
    }

    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    const { error } = await supabase
      .from('exam_systems')
      .delete()
      .eq('id', deleteConfirm.id)
    if (error) { alert(`Error: ${error.message}`) }
    setDeleting(false)
    setDeleteConfirm(null)
    load()
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        You do not have permission to access this page.
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Exam Systems</h1>
          <p className="text-sm text-gray-500 mt-1">Manage exam system types used when creating classes.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No exam systems defined yet.</p>
            <p className="mt-1">Click <strong>Add</strong> to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)} title="Edit">
                      <Pencil className="h-3.5 w-3.5 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(item)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Exam System' : 'Add Exam System'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. KSSM, SPM, IGCSE"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <p className="text-xs text-gray-400">Name will be auto-capitalized.</p>
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
            <DialogTitle>Delete Exam System</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Delete <strong>{deleteConfirm?.name}</strong>? Classes using this exam system won&apos;t be affected.
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
