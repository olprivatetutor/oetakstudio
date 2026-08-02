import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-[color,box-shadow,background] focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-xs)] [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary/12 text-secondary shadow-[var(--shadow-xs)] [a&]:hover:bg-secondary/18 dark:bg-secondary/18 dark:text-secondary-foreground",
        destructive:
          "bg-destructive/12 text-destructive shadow-[var(--shadow-xs)] [a&]:hover:bg-destructive/18 focus-visible:ring-destructive/25",
        outline:
          "bg-card/70 text-foreground shadow-[var(--shadow-xs)] ring-1 ring-border/35 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
