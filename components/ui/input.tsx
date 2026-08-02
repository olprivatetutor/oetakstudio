import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-11 w-full min-w-0 rounded-[1rem] bg-[color:var(--surface-raised)]/78 px-4 py-2 text-base shadow-[var(--shadow-xs)] ring-1 ring-input/55 transition-[color,box-shadow,background] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:bg-card focus-visible:ring-ring/45 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/35",
        className
      )}
      {...props}
    />
  )
}

export { Input }
