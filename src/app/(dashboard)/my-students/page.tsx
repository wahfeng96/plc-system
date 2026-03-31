'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { StudentSubject, Student } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, GraduationCap } from 'lucide-react'

export default function MyStudentsPage() {
  const { teacher } = useAuth()
  const [studentSubs, setStudentSubs] = useState<(StudentSubject & { student?: Student })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  const load = useCallback(async () => {
    if (!teacher) { setLoading(false); return }
    const { data } = await supabase
      .from('student_subjects')
      .select('*, student:students(*)')
      .eq('teacher_id', teacher.id)
      .eq('status', 'active')
      .order('subject')
    setStudentSubs(data || [])
    setLoading(false)
  }, [supabase, teacher])

  useEffect(() => { load() }, [load])

  if (!teacher) return <div className="text-center py-12 text-gray-500">No teacher profile linked</div>
  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  const filtered = studentSubs.filter(ss =>
    ss.student?.name.toLowerCase().includes(search.toLowerCase()) ||
    ss.subject.toLowerCase().includes(search.toLowerCase())
  )

  // Group by subject
  const grouped = new Map<string, typeof filtered>()
  for (const ss of filtered) {
    const key = `${ss.subject} (${ss.exam_system})`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(ss)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Students</h1>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search students or subjects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {grouped.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <GraduationCap className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No students enrolled
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([subject, items]) => (
          <Card key={subject} className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{subject}</span>
                <Badge variant="secondary">{items.length} students</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map(ss => (
                  <div key={ss.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{ss.student?.name}</p>
                      <p className="text-xs text-gray-500">{ss.student?.form_level}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>RM{ss.tuition_fee}/mo</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
