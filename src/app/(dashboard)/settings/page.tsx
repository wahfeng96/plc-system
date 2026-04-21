'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Setting {
  id: string
  key: string
  value: string
  description: string | null
}

export default function SettingsPage() {
  const { role } = useAuth()
  const supabase = createClient()

  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [ratePerHour, setRatePerHour] = useState('')
  const [ratePerStudent, setRatePerStudent] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('settings')
      .select('*')
      .in('key', ['rate_per_hour', 'rate_per_student'])

    const settingsList = (data || []) as Setting[]
    setSettings(settingsList)

    const hourSetting = settingsList.find(s => s.key === 'rate_per_hour')
    const studentSetting = settingsList.find(s => s.key === 'rate_per_student')

    setRatePerHour(hourSetting?.value || '15')
    setRatePerStudent(studentSetting?.value || '5')

    setLoading(false)
  }

  async function save() {
    setSaving(true)

    // Update rate_per_hour
    await supabase
      .from('settings')
      .update({ value: ratePerHour, updated_at: new Date().toISOString() })
      .eq('key', 'rate_per_hour')

    // Update rate_per_student
    await supabase
      .from('settings')
      .update({ value: ratePerStudent, updated_at: new Date().toISOString() })
      .eq('key', 'rate_per_student')

    setSaving(false)
    alert('Settings saved successfully!')
  }

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Admin access only.
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Headcount & Rental Rates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rate_per_hour">Rental Fee per Hour (RM)</Label>
                <Input
                  id="rate_per_hour"
                  type="number"
                  value={ratePerHour}
                  onChange={e => setRatePerHour(e.target.value)}
                  placeholder="15"
                />
                <p className="text-xs text-gray-500">
                  The hourly rate charged for room rental to ISM.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate_per_student">Head Count Fee per Student (RM)</Label>
                <Input
                  id="rate_per_student"
                  type="number"
                  value={ratePerStudent}
                  onChange={e => setRatePerStudent(e.target.value)}
                  placeholder="5"
                />
                <p className="text-xs text-gray-500">
                  The fee charged per student enrolled with each teacher.
                </p>
              </div>

              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
