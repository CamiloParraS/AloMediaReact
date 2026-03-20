import type React from "react"

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  label: string
  variant?: "ghost" | "solid" | "danger"
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  active?: boolean
  accent?: boolean
  square?: boolean
}

const BTN_SIZE: Record<NonNullable<IconButtonProps["size"]>, string> = {
  xs: "w-5 h-5",
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-9 h-9",
  xl: "w-10 h-10",
}

const ICON_SIZE: Record<NonNullable<IconButtonProps["size"]>, string> = {
  xs: "[&>svg]:w-3 [&>svg]:h-3",
  sm: "[&>svg]:w-3.5 [&>svg]:h-3.5",
  md: "[&>svg]:w-4 [&>svg]:h-4",
  lg: "[&>svg]:w-[18px] [&>svg]:h-[18px]",
  xl: "[&>svg]:w-5 [&>svg]:h-5",
}

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  active = false,
  accent = false,
  square = false,
  className = "",
  ...props
}: IconButtonProps) {
  const radius = square ? "rounded-none" : "rounded-md"

  const variantCls =
    variant === "solid"
      ? "bg-accent-red text-accent-white hover:brightness-110 active:brightness-90"
      : variant === "danger"
        ? "text-muted hover:text-red-400 hover:bg-red-900/40 active:bg-red-900/60"
        : active
          ? "text-accent-red bg-dark-elevated hover:bg-dark-elevated active:bg-dark-border active:text-blood-red-light"
          : accent
            ? "text-accent-red hover:bg-dark-elevated active:bg-dark-border active:text-blood-red-light"
            : "text-muted-light hover:text-accent-white hover:bg-dark-elevated active:bg-dark-border active:text-blood-red-light"

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        "editor-transition inline-flex items-center justify-center shrink-0 cursor-pointer",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        !square && "active:scale-[0.93] disabled:active:scale-100",
        BTN_SIZE[size],
        ICON_SIZE[size],
        radius,
        variantCls,
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {icon}
    </button>
  )
}
