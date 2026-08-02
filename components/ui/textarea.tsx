import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground flex field-sizing-content min-h-24 w-full rounded-[1rem] bg-[color:var(--surface-raised)]/78 px-4 py-3 text-base leading-6 shadow-[var(--shadow-xs)] ring-1 ring-input/55 transition-[color,box-shadow,background] outline-none focus-visible:bg-card focus-visible:ring-ring/45 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/35",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
