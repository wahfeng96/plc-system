"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.HTMLAttributes<HTMLDivElement>

function Calendar({ className, ...props }: CalendarProps) {
  return <div className={cn("p-3", className)} {...props} />
}

export { Calendar }
