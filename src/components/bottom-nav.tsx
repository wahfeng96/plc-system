'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard, Calendar, ClipboardList, Menu, X,
  Clock, UserCheck, BookOpen, DoorOpen, Users, GraduationCap,
  FileText, CalendarOff, DollarSign, ShieldCheck, Library, Calculator, Settings
} from 'lucide-react'

const adminMainNav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/timetable', label: 'Timetable', icon: Calendar },
  { href: '/attendance', label: 'Attend', icon: ClipboardList },
]

const adminMoreLinks = [
  { href: '/classes', label: 'Classes', icon: Library },
  { href: '/teachers', label: 'Teachers', icon: Users },
  { href: '/students', label: 'Students', icon: GraduationCap },
  { href: '/rooms', label: 'Rooms', icon: DoorOpen },
  { href: '/tuition-fees', label: 'Tuition Fees', icon: DollarSign },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/holidays', label: 'Holidays', icon: CalendarOff },
  { href: '/headcount-rental', label: 'Headcount', icon: Calculator },
  { href: '/users', label: 'Users', icon: ShieldCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const teacherNav = [
  { href: '/my-schedule', label: 'Schedule', icon: Clock },
  { href: '/take-attendance', label: 'Attend', icon: UserCheck },
  { href: '/my-students', label: 'Students', icon: BookOpen },
  { href: '/my-rental', label: 'Rental', icon: DollarSign },
]

const guardNav = [
  { href: '/guard', label: 'Schedule', icon: DoorOpen },
]

export function BottomNav() {
  const pathname = usePathname()
  const { role, allowedPages } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  if (role === 'admin') {
    return (
      <>
        {/* More menu overlay */}
        {moreOpen && (
          <div className="md:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 z-10 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">More</h3>
                <button onClick={() => setMoreOpen(false)} className="p-1">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {adminMoreLinks.map(item => {
                  const Icon = item.icon
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs',
                        active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
          <div className="flex justify-around items-center h-16">
            {adminMainNav.map(item => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                    active ? 'text-blue-600' : 'text-gray-500'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                moreOpen || adminMoreLinks.some(l => pathname === l.href) ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <Menu className="h-5 w-5" />
              More
            </button>
          </div>
        </nav>
      </>
    )
  }

  // Teacher / Guard — simple nav
  const nav = role === 'teacher' ? teacherNav : guardNav
  const filteredNav = (!allowedPages || allowedPages.length === 0)
    ? nav
    : nav.filter(l => allowedPages.includes(l.href))

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="flex justify-around items-center h-16">
        {filteredNav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                active ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
