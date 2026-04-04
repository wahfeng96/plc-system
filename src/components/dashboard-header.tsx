'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export function DashboardHeader() {
  const { role } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <Image src="/plc-logo.jpg" alt="PLC Logo" width={32} height={32} className="rounded-full" />
        <h2 className="text-lg font-semibold text-blue-600">PLC System</h2>
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 capitalize">{role}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
