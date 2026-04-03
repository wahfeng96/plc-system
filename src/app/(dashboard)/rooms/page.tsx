'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Room } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DoorOpen, Pencil, Trash2, Calendar, Plus } from 'lucide-react'

interface RoomWithUtilization extends Room {
  classes_per_week: number
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomWithUtilization[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [form, setForm] = useState({ name: '', hourly_rate: 22, status: 'active' as 'active' | 'inactive' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const [roomsRes, schedulesRes] = await Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('schedules').select('room_id').eq('status', 'active'),
    ])

    const schedules = schedulesRes.data || []
    const countMap: Record<string, number> = {}
    for (const s of schedules) {
      countMap[s.room_id] = (countMap[s.room_id] || 0) + 1
    }

    const enriched: RoomWithUtilization[] = (roomsRes.data || []).map(r => ({
      ...r,
      classes_per_week: countMap[r.id] || 0,
    }))

    setRooms(enriched)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', hourly_rate: 22, status: 'active' })
    setDialogOpen(true)
  }

  function openEdit(r: Room) {
    setEditing(r)
    setForm({ name: r.name, hourly_rate: r.hourly_rate, status: r.status })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('rooms').update({
        name: form.name,
        hourly_rate: form.hourly_rate,
        status: form.status,
      }).eq('id', editing.id)
    } else {
      await supabase.from('rooms').insert({
        name: form.name,
        hourly_rate: form.hourly_rate,
        status: form.status,
      })
    }
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    await supabase.from('rooms').update({ status: 'inactive' }).eq('id', deleteConfirm.id)
    setDeleting(false)
    setDeleteConfirm(null)
    load()
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Room
        </Button>
      </div>

      {rooms.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <DoorOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No rooms yet. Click <strong>Add Room</strong> to get started.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {rooms.map(room => (
          <Card key={room.id} className={`relative transition-all ${room.status === 'inactive' ? 'opacity-60' : ''}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${room.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{room.name}</p>
                  <p className="text-sm text-gray-500">RM{room.hourly_rate}/hr</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <Badge variant={room.status === 'active' ? 'default' : 'secondary'}>
                  {room.status}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" /> {room.classes_per_week} classes/wk
                </span>
              </div>
              <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(room)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setDeleteConfirm(room)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'Add Room'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Room Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Hourly Rate (RM)</Label>
              <Input
                type="number"
                value={form.hourly_rate}
                onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))}
              />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Room</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to deactivate <strong>{deleteConfirm?.name}</strong>? It will be hidden from scheduling but can be reactivated later.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deactivating...' : 'Deactivate Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
