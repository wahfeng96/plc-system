'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Student, Teacher, StudentSubject, ClassType } from '@/lib/types'
import { SUBJECTS, FORM_LEVELS } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Plus, Search, Eye, X, Trash2, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'

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
  const [editStudent, setEditStudent] = useState<Student | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [allStudentSubjects, setAllStudentSubjects] = useState<StudentSubject[]>([])
  const [formFilter, setFormFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const supabase = createClient()
  const { role, teacher } = useAuth()

  const load = useCallback(async () => {
    const [teachersRes, classTypesRes, studentSubjectsRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
      supabase.from('class_types').select('*').eq('status', 'active').order('name'),
      supabase.from('student_subjects').select('*').eq('status', 'active'),
    ])
    setTeachers(teachersRes.data || [])
    setClassTypes(classTypesRes.data || [])
    setAllStudentSubjects(studentSubjectsRes.data || [])

    // Admin sees all students. Teacher sees only their enrolled students.
    if (role === 'teacher' && teacher) {
      const { data: subs } = await supabase
        .from('student_subjects')
        .select('student_id')
        .eq('teacher_id', teacher.id)
        .eq('status', 'active')
      const studentIds = Array.from(new Set((subs || []).map(s => s.student_id)))
      if (studentIds.length > 0) {
        const { data } = await supabase.from('students').select('*').in('id', studentIds).order('name')
        setStudents(data || [])
      } else {
        setStudents([])
      }
    } else {
      const { data } = await supabase.from('students').select('*').order('name')
      setStudents(data || [])
    }

    setLoading(false)
  }, [supabase, role, teacher])

  useEffect(() => { load() }, [load])

  function calcFee(count: number) {
    if (count === 0) return 0
    return 100 + (count - 1) * 50
  }

  function addSubject() {
    const first = classTypes[0]
    setSubjects(s => [...s, {
      teacher_id: '', subject: first?.name || SUBJECTS[0], exam_system: first?.exam_system || 'SPM',
      tuition_fee: 0, registered_by_admin: true,
    }])
  }

  function selectClassType(index: number, classTypeId: string) {
    const ct = classTypes.find(c => c.id === classTypeId)
    if (!ct) return
    setSubjects(s => s.map((sub, i) => i === index ? {
      ...sub,
      subject: ct.name,
      exam_system: ct.exam_system,
    } : sub))
  }

  function removeSubject(i: number) {
    setSubjects(s => s.filter((_, idx) => idx !== i))
  }

  function updateSubject(i: number, field: string, value: string | number | boolean) {
    setSubjects(s => s.map((sub, idx) => idx === i ? { ...sub, [field]: value } : sub))
  }

  async function openEdit(student: Student) {
    setEditStudent(student)
    setForm({
      name: student.name,
      phone: student.phone || '',
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      form_level: student.form_level,
      registered_by: student.registered_by,
    })
    // Load existing subjects
    const { data } = await supabase
      .from('student_subjects')
      .select('*')
      .eq('student_id', student.id)
      .eq('status', 'active')
    setSubjects((data || []).map(s => ({
      teacher_id: s.teacher_id,
      subject: s.subject,
      exam_system: s.exam_system,
      tuition_fee: s.tuition_fee,
      registered_by_admin: s.registered_by_admin,
    })))
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)

    if (editStudent) {
      // Update existing student
      const { error } = await supabase.from('students').update({
        name: form.name,
        phone: form.phone || null,
        parent_name: form.parent_name,
        parent_phone: form.parent_phone,
        form_level: form.form_level,
        registered_by: form.registered_by,
      }).eq('id', editStudent.id)

      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }

      // Replace subjects: delete old, insert new
      await supabase.from('student_subjects').delete().eq('student_id', editStudent.id)
      if (subjects.length > 0) {
        const year = new Date().getFullYear()
        await supabase.from('student_subjects').insert(
          subjects.filter(s => s.teacher_id).map(s => ({
            student_id: editStudent.id,
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
    } else {
      // Create new student
      const { data: student, error } = await supabase.from('students').insert({
        ...form,
        registration_date: new Date().toISOString().split('T')[0],
      }).select().single()

      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }

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
    }

    setSaving(false)
    setDialogOpen(false)
    setEditStudent(null)
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

  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    // Delete related student_subjects first, then the student
    await supabase.from('student_subjects').delete().eq('student_id', deleteConfirm.id)
    await supabase.from('attendance').delete().eq('student_id', deleteConfirm.id)
    await supabase.from('students').delete().eq('id', deleteConfirm.id)
    setDeleting(false)
    setDeleteConfirm(null)
    load()
  }

  async function toggleStatus(student: Student) {
    setToggling(student.id)
    const newStatus = student.status === 'active' ? 'inactive' : 'active'
    await supabase.from('students').update({ status: newStatus }).eq('id', student.id)
    setToggling(null)
    load()
  }

  const uniqueSubjects = Array.from(new Set(classTypes.map(ct => ct.name)))

  const filtered = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.parent_name.toLowerCase().includes(search.toLowerCase())
    const matchesForm = !formFilter || s.form_level === formFilter
    const matchesSubject = !subjectFilter || allStudentSubjects.some(
      ss => ss.student_id === s.id && ss.subject === subjectFilter
    )
    return matchesSearch && matchesForm && matchesSubject
  })

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Students</h1>
        {role === 'admin' && (
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditStudent(null); setForm(emptyForm); setSubjects([]); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Register Student
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            <select
              value={formFilter}
              onChange={e => setFormFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All Forms</option>
              {FORM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All Subjects</option>
              {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Form</TableHead>
                <TableHead className="hidden md:table-cell">Parent</TableHead>
                <TableHead className="hidden md:table-cell">Registered By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="group/tip">
                      <Tooltip>
                        <TooltipTrigger className="font-medium cursor-default">
                          {s.name}
                        </TooltipTrigger>
                        <TooltipContent className="invisible group-hover/tip:visible absolute left-0 top-full mt-1 w-64 whitespace-normal">
                          <div className="text-xs">
                            <div className="font-semibold mb-1">Enrolled Subjects:</div>
                            {(() => {
                              const subs = allStudentSubjects.filter(ss => ss.student_id === s.id)
                              if (subs.length === 0) return <div>No subjects enrolled</div>
                              return subs.map(ss => {
                                const t = teachers.find(tc => tc.id === ss.teacher_id)
                                return <div key={ss.id}>{ss.subject} — {t?.name || 'Unknown'}</div>
                              })
                            })()}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{s.form_level}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.parent_name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={s.registered_by === 'admin' ? 'default' : 'secondary'}>{s.registered_by}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {role === 'admin' && (
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)} title="Edit">
                          <Pencil className="h-4 w-4 text-blue-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => viewDetail(s)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {role === 'admin' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleStatus(s)}
                            disabled={toggling === s.id}
                            title={s.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            {s.status === 'active'
                              ? <ToggleRight className="h-4 w-4 text-green-600" />
                              : <ToggleLeft className="h-4 w-4 text-gray-400" />
                            }
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => setDeleteConfirm(s)} title="Delete">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
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
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Register Student Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editStudent ? 'Edit Student' : 'Register New Student'}</DialogTitle>
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
                <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 p-3 bg-gray-50 rounded-lg">
                  <select
                    value={classTypes.find(ct => ct.name === sub.subject)?.id || ''}
                    onChange={e => selectClassType(i, e.target.value)}
                    className="h-8 rounded-lg border border-input bg-white px-2 text-sm col-span-2 md:col-span-1"
                  >
                    <option value="">Select class</option>
                    {classTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                    {/* Fallback: show current subject if not in classTypes */}
                    {!classTypes.find(ct => ct.name === sub.subject) && sub.subject && (
                      <option value="" disabled>({sub.subject} — legacy)</option>
                    )}
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
              {saving ? 'Saving...' : editStudent ? 'Save Changes' : 'Register Student'}
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
                <div><span className="text-gray-500">Status:</span> <Badge variant={detailStudent.status === 'active' ? 'default' : 'secondary'}>{detailStudent.status}</Badge></div>
                <div><span className="text-gray-500">Phone:</span> {detailStudent.phone || '—'}</div>
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
                    <div className="mt-2 p-2 bg-blue-50 rounded-lg text-sm">
                      <strong>Total Tuition: RM{detailSubjects.reduce((sum, ss) => sum + (ss.tuition_fee || 0), 0)}/mo</strong>
                      <span className="text-gray-500 ml-2">
                        &middot; Registration Fee: RM{calcFee(detailSubjects.length)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This will also remove all their subject enrollments and attendance records. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
