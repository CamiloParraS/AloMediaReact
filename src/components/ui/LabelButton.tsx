import type React from "react"
import { Loader2 } from "lucide-react"

interface LabelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string
  variant?: "primary" | "secondary" | "accent" | "ghost"
  size?: "sm" | "md" | "lg"
  /** Replaces the icon with a spinner and disables the button */
  loading?: boolean
}

const BTN_SIZE = {
  sm: "h-7 px-3 text-xs gap-1.5",
  md: "h-8 px-4 text-sm gap-2",
  lg: "h-9 px-5 text-sm gap-2",
} as const

const ICON_SIZE = {
  sm: "[&>svg]:w-3.5 [&>svg]:h-3.5",
  md: "[&>svg]:w-4 [&>svg]:h-4",
  lg: "[&>svg]:w-4 [&>svg]:h-4",
} as const

const VARIANT = {
  primary:
    "bg-linear-to-r from-blood-red to-crimson hover:from-blood-red-light hover:to-blood-red-glow text-accent-white shadow-sm shadow-blood-red/20 active:scale-[0.97]",
  secondary:
    "border border-dark-border bg-dark-elevated text-accent-white hover:bg-dark-border active:bg-dark-surface active:scale-[0.97]",
  accent:
    "border border-blood-red-light bg-accent-red text-white hover:bg-blood-red-light active:bg-blood-red disabled:opacity-60",
  ghost:
    "text-muted-light hover:bg-dark-elevated hover:text-accent-white active:bg-dark-border active:text-blood-red-light",
} as const

export function LabelButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...props
}: LabelButtonProps) {
  return (
    <button
      type="button"
      disabled={loading || disabled}
      className={[
        "editor-transition inline-flex items-center font-semibold tracking-wide rounded-lg cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        BTN_SIZE[size],
        ICON_SIZE[size],
        VARIANT[variant],
        className,
      ].join(" ")}
      {...props}
    >
      <span className="flex items-center shrink-0">
        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : icon}
      </span>
      {label}
    </button>
  )
}
