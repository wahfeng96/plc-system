'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { UserRole, Teacher } from './types'

interface AuthContextType {
  userId: string
  role: UserRole
  teacher: Teacher | null
  allowedPages: string[] | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({
  children,
  value,
}: {
  children: ReactNode
  value: AuthContextType
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
