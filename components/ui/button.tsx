import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] text-sm font-semibold tracking-normal transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/45 focus-visible:ring-[3px] active:scale-[0.985]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_14px_34px_rgba(39,64,41,0.2)] hover:bg-primary/92 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(39,64,41,0.24)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.34)]",
        destructive:
          "bg-destructive text-white shadow-[var(--shadow-sm)] hover:bg-destructive/90 focus-visible:ring-destructive/30",
        outline:
          "bg-card/72 text-foreground shadow-[var(--shadow-xs)] ring-1 ring-border/45 backdrop-blur hover:bg-accent hover:text-accent-foreground hover:shadow-[var(--shadow-sm)]",
        secondary:
          "bg-muted text-foreground shadow-[var(--shadow-xs)] hover:bg-accent hover:text-accent-foreground hover:shadow-[var(--shadow-sm)]",
        ghost:
          "text-foreground hover:bg-accent/78 hover:text-accent-foreground",
        link: "h-auto rounded-none px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 rounded-[0.9rem] px-4 has-[>svg]:px-3",
        lg: "h-12 rounded-[1.1rem] px-7 text-base has-[>svg]:px-5",
        icon: "size-10 rounded-[1rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
