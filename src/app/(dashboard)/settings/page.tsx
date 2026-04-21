'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calculator, GraduationCap } from 'lucide-react'

export default function SettingsPage() {
  const { role } = useAuth()

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Admin access only.
      </div>
    )
  }

  const settingsOptions = [
    {
      href: '/settings/rates',
      title: 'Headcount & Rental Rates',
      description: 'Configure RM per hour and per student rates',
      icon: Calculator,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      href: '/settings/exam-systems',
      title: 'Exam Systems',
      description: 'Manage exam systems (PT3, SPM, IGCSE, etc.)',
      icon: GraduationCap,
      color: 'text-green-600 bg-green-50',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsOptions.map((option) => {
          const Icon = option.icon
          return (
            <Link key={option.href} href={option.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${option.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{option.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{option.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
