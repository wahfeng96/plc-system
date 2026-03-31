'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ScheduleException } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, CalendarOff } from 'lucide-react'

const EXCEPTION_TYPES = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'exam_break', label: 'Exam Break' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'replacement', label: 'Replacement Class' },
]

export default function HolidaysPage() {
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'holiday' as string,
    title: '',
    affects: 'all' as string,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('schedule_exceptions')
      .select('*')
      .order('date', { ascending: false })
    setExceptions(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    await supabase.from('schedule_exceptions').insert({
      date: form.date,
      type: form.type,
      title: form.title,
      affects: form.affects,
      notes: form.notes || null,
    })
    setSaving(false)
    setDialogOpen(false)
    setForm({ date: new Date().toISOString().split('T')[0], type: 'holiday', title: '', affects: 'all', notes: '' })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this exception?')) return
    await supabase.from('schedule_exceptions').delete().eq('id', id)
    load()
  }

  const typeColors: Record<string, string> = {
    holiday: 'bg-red-100 text-red-800',
    exam_break: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-gray-100 text-gray-800',
    replacement: 'bg-green-100 text-green-800',
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Holidays & Exceptions</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Exception
        </Button>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Affects</TableHead>
                <TableHead className="hidden md:table-cell">Notes</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map(ex => (
                <TableRow key={ex.id}>
                  <TableCell className="font-medium">{ex.date}</TableCell>
                  <TableCell>{ex.title}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[ex.type] || ''}`}>
                      {ex.type}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{ex.affects}</TableCell>
                  <TableCell className="hidden md:table-cell text-gray-500">{ex.notes || '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(ex.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {exceptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    <CalendarOff className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No holidays or exceptions configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Holiday / Exception</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Chinese New Year"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {EXCEPTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Affects</Label>
              <select
                value={form.affects}
                onChange={e => setForm(f => ({ ...f, affects: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="all">All classes</option>
                <option value="specific">Specific schedule only</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Additional details..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving || !form.title}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
