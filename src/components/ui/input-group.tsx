import * as React from "react"
import { cn } from "@/lib/utils"

function InputGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

function InputGroupAddon({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center text-sm text-muted-foreground", className)} {...props} />
  )
}

export { InputGroup, InputGroupAddon }
