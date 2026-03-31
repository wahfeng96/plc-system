'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, Teacher, StudentSubject } from '@/lib/types'
import { SUBJECTS, EXAM_SYSTEMS, FORM_LEVELS } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Search, Eye, X } from 'lucide-react'

interface SubjectEntry {
  teacher_id: string
  subject: string
  exam_system: string
  tuition_fee: number
  registered_by_admin: boolean
}

const emptyForm = {
  name: '', phone: '', parent_name: '', parent_phone: '',
  form_level: 'Form 1', registered_by: 'admin' as 'admin' | 'teacher',
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailStudent, setDetailStudent] = useState<Student | null>(null)
  const [detailSubjects, setDetailSubjects] = useState<(StudentSubject & { teacher?: Teacher })[]>([])
  const [form, setForm] = useState(emptyForm)
  const [subjects, setSubjects] = useState<SubjectEntry[]>([])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const [studentsRes, teachersRes] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
    ])
    setStudents(studentsRes.data || [])
    setTeachers(teachersRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function calcFee(count: number) {
    if (count === 0) return 0
    return 100 + (count - 1) * 50
  }

  function addSubject() {
    setSubjects(s => [...s, {
      teacher_id: '', subject: SUBJECTS[0], exam_system: 'SPM',
      tuition_fee: 0, registered_by_admin: true,
    }])
  }

  function removeSubject(i: number) {
    setSubjects(s => s.filter((_, idx) => idx !== i))
  }

  function updateSubject(i: number, field: string, value: string | number | boolean) {
    setSubjects(s => s.map((sub, idx) => idx === i ? { ...sub, [field]: value } : sub))
  }

  async function handleSave() {
    setSaving(true)
    const { data: student } = await supabase.from('students').insert({
      ...form,
      registration_date: new Date().toISOString().split('T')[0],
    }).select().single()

    if (student && subjects.length > 0) {
      const year = new Date().getFullYear()
      await supabase.from('student_subjects').insert(
        subjects.filter(s => s.teacher_id).map(s => ({
          student_id: student.id,
          teacher_id: s.teacher_id,
          subject: s.subject,
          exam_system: s.exam_system,
          tuition_fee: s.tuition_fee,
          academic_year: year,
          registered_by_admin: s.registered_by_admin,
          commission_start: new Date().toISOString().split('T')[0],
        }))
      )
    }

    setSaving(false)
    setDialogOpen(false)
    setForm(emptyForm)
    setSubjects([])
    load()
  }

  async function viewDetail(student: Student) {
    setDetailStudent(student)
    const { data } = await supabase
      .from('student_subjects')
      .select('*, teacher:teachers(*)')
      .eq('student_id', student.id)
      .order('created_at')
    setDetailSubjects(data || [])
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.parent_name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Students</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setForm(emptyForm); setSubjects([]); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Register Student
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Form</TableHead>
                <TableHead className="hidden md:table-cell">Parent</TableHead>
                <TableHead className="hidden md:table-cell">Registered By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.form_level}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.parent_name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={s.registered_by === 'admin' ? 'default' : 'secondary'}>{s.registered_by}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => viewDetail(s)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">No students found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Register Student Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Student Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Student Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Parent Name</Label>
                <Input value={form.parent_name} onChange={e => setForm(f => ({ ...f, parent_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Parent Phone</Label>
                <Input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Form Level</Label>
                <select
                  value={form.form_level}
                  onChange={e => setForm(f => ({ ...f, form_level: e.target.value }))}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {FORM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Registered By</Label>
                <select
                  value={form.registered_by}
                  onChange={e => setForm(f => ({ ...f, registered_by: e.target.value as 'admin' | 'teacher' }))}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>Subjects</Label>
                <Button variant="outline" size="sm" onClick={addSubject}>
                  <Plus className="h-3 w-3 mr-1" /> Add Subject
                </Button>
              </div>

              {subjects.map((sub, i) => (
                <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                  <select
                    value={sub.subject}
                    onChange={e => updateSubject(i, 'subject', e.target.value)}
                    className="h-8 rounded-lg border border-input bg-white px-2 text-sm"
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    value={sub.exam_system}
                    onChange={e => updateSubject(i, 'exam_system', e.target.value)}
                    className="h-8 rounded-lg border border-input bg-white px-2 text-sm"
                  >
                    {EXAM_SYSTEMS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <select
                    value={sub.teacher_id}
                    onChange={e => updateSubject(i, 'teacher_id', e.target.value)}
                    className="h-8 rounded-lg border border-input bg-white px-2 text-sm"
                  >
                    <option value="">Select teacher</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <Input
                    type="number"
                    placeholder="Fee (RM)"
                    value={sub.tuition_fee || ''}
                    onChange={e => updateSubject(i, 'tuition_fee', Number(e.target.value))}
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={sub.registered_by_admin}
                        onChange={e => updateSubject(i, 'registered_by_admin', e.target.checked)}
                        className="rounded"
                      />
                      Commission
                    </label>
                    <Button variant="ghost" size="icon-sm" onClick={() => removeSubject(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {subjects.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                  <strong>Registration Fee: RM {calcFee(subjects.length)}</strong>
                  <span className="text-gray-500 ml-2">
                    (RM100 first subject{subjects.length > 1 ? ` + RM${(subjects.length - 1) * 50} for ${subjects.length - 1} extra` : ''})
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving || !form.name}>
              {saving ? 'Saving...' : 'Register Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Detail Dialog */}
      <Dialog open={!!detailStudent} onOpenChange={() => setDetailStudent(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailStudent?.name}</DialogTitle>
          </DialogHeader>
          {detailStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Form:</span> {detailStudent.form_level}</div>
                <div><span className="text-gray-500">Status:</span> {detailStudent.status}</div>
                <div><span className="text-gray-500">Parent:</span> {detailStudent.parent_name}</div>
                <div><span className="text-gray-500">Parent Phone:</span> {detailStudent.parent_phone}</div>
                <div><span className="text-gray-500">Registered By:</span> {detailStudent.registered_by}</div>
                <div><span className="text-gray-500">Date:</span> {detailStudent.registration_date}</div>
              </div>
              <div>
                <Label className="mb-2">Enrolled Subjects</Label>
                {detailSubjects.length === 0 ? (
                  <p className="text-sm text-gray-500">No subjects enrolled</p>
                ) : (
                  <div className="space-y-2">
                    {detailSubjects.map(ss => (
                      <div key={ss.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{ss.subject}</span>
                          <span className="text-gray-500 ml-2">({ss.exam_system})</span>
                          {ss.teacher && <span className="text-gray-500 ml-2">— {ss.teacher.name}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>RM{ss.tuition_fee}/mo</span>
                          <Badge variant={ss.status === 'active' ? 'default' : 'secondary'}>{ss.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
