'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Schedule, Teacher, Room } from '@/lib/types'
import { DAYS, TIME_SLOTS } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SUBJECTS, EXAM_SYSTEMS, CLASS_TYPES } from '@/lib/types'
import { Plus } from 'lucide-react'

const TEACHER_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-red-100 text-red-800 border-red-200',
]

export default function TimetablePage() {
  const [schedules, setSchedules] = useState<(Schedule & { teacher?: Teacher; room?: Room })[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    teacher_id: '', room_id: '', subject: SUBJECTS[0], exam_system: 'SPM',
    day_of_week: 1, start_time: '14:00', end_time: '16:00', class_type: 'large_group',
    effective_from: new Date().toISOString().split('T')[0],
  })
  const supabase = createClient()

  const teacherColorMap = new Map<string, string>()
  teachers.forEach((t, i) => teacherColorMap.set(t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]))

  const load = useCallback(async () => {
    const [schedulesRes, roomsRes, teachersRes] = await Promise.all([
      supabase.from('schedules').select('*, teacher:teachers(*), room:rooms(*)').eq('status', 'active'),
      supabase.from('rooms').select('*').eq('status', 'active').order('name'),
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
    ])
    setSchedules(schedulesRes.data || [])
    setRooms(roomsRes.data || [])
    setTeachers(teachersRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function getSlotSchedules(roomId: string, time: string) {
    return schedules.filter(s =>
      s.room_id === roomId &&
      s.day_of_week === selectedDay &&
      s.start_time <= time &&
      s.end_time > time
    )
  }

  function openCreate(roomId?: string, time?: string) {
    setEditSchedule(null)
    setForm({
      teacher_id: teachers[0]?.id || '', room_id: roomId || rooms[0]?.id || '',
      subject: SUBJECTS[0], exam_system: 'SPM',
      day_of_week: selectedDay, start_time: time || '14:00', end_time: time ? `${parseInt(time) + 2}:00` : '16:00',
      class_type: 'large_group', effective_from: new Date().toISOString().split('T')[0],
    })
    setDialogOpen(true)
  }

  function openEdit(s: Schedule) {
    setEditSchedule(s)
    setForm({
      teacher_id: s.teacher_id, room_id: s.room_id, subject: s.subject,
      exam_system: s.exam_system, day_of_week: s.day_of_week,
      start_time: s.start_time, end_time: s.end_time, class_type: s.class_type,
      effective_from: s.effective_from,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    // Check for room conflicts
    const conflicts = schedules.filter(s =>
      s.room_id === form.room_id &&
      s.day_of_week === form.day_of_week &&
      s.start_time < form.end_time &&
      s.end_time > form.start_time &&
      s.id !== editSchedule?.id
    )
    if (conflicts.length > 0) {
      alert(`Room conflict! ${conflicts[0].teacher?.name || 'Another teacher'} already has this room booked at this time.`)
      setSaving(false)
      return
    }

    if (editSchedule) {
      await supabase.from('schedules').update(form).eq('id', editSchedule.id)
    } else {
      await supabase.from('schedules').insert(form)
    }
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete() {
    if (!editSchedule) return
    await supabase.from('schedules').update({ status: 'cancelled' }).eq('id', editSchedule.id)
    setDialogOpen(false)
    load()
  }

  const displayTimes = TIME_SLOTS.filter(t => parseInt(t) >= 8 && parseInt(t) <= 20)

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Timetable</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-1" /> Add Class
        </Button>
      </div>

      {/* Day selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {DAYS.map((day, i) => (
          <button
            key={day}
            onClick={() => setSelectedDay(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDay === i
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Teacher legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {teachers.map(t => (
          <span key={t.id} className={`px-2 py-0.5 rounded text-xs font-medium border ${teacherColorMap.get(t.id)}`}>
            {t.name}
          </span>
        ))}
      </div>

      {/* Grid view */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium sticky left-0 bg-white min-w-[100px]">Room</th>
                {displayTimes.map(time => (
                  <th key={time} className="p-2 text-center font-medium min-w-[100px]">{time}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="border-b">
                  <td className="p-2 font-medium sticky left-0 bg-white">{room.name}</td>
                  {displayTimes.map(time => {
                    const slotSchedules = getSlotSchedules(room.id, time)
                    return (
                      <td
                        key={time}
                        className="p-1 cursor-pointer hover:bg-gray-50 min-w-[100px]"
                        onClick={() => slotSchedules.length === 0 ? openCreate(room.id, time) : openEdit(slotSchedules[0])}
                      >
                        {slotSchedules.map(s => (
                          <div
                            key={s.id}
                            className={`px-1.5 py-1 rounded text-xs border ${teacherColorMap.get(s.teacher_id) || 'bg-gray-100'}`}
                          >
                            <div className="font-medium truncate">{s.teacher?.name}</div>
                            <div className="truncate">{s.subject}</div>
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSchedule ? 'Edit Class Schedule' : 'Add Class Schedule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Teacher</Label>
                <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Room</Label>
                <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Subject</Label>
                <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Exam System</Label>
                <select value={form.exam_system} onChange={e => setForm(f => ({ ...f, exam_system: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {EXAM_SYSTEMS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Day</Label>
                <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Class Type</Label>
                <select value={form.class_type} onChange={e => setForm(f => ({ ...f, class_type: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {CLASS_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Start Time</Label>
                <select value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>End Time</Label>
                <select value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Effective From</Label>
              <Input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            {editSchedule && (
              <Button variant="destructive" onClick={handleDelete} className="mr-auto">Cancel Class</Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
