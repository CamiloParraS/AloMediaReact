interface DividerProps {
  orientation?: "vertical" | "horizontal"
  className?: string
}

export function Divider({ orientation = "vertical", className = "" }: DividerProps) {
  if (orientation === "horizontal") {
    return (
      <div
        aria-hidden
        className={`w-full my-1 ${className}`}
        style={{ height: 1, backgroundColor: "var(--color-dark-border)" }}
      />
    )
  }
  return (
    <div
      aria-hidden
      className={`mx-1 shrink-0 ${className}`}
      style={{ width: 1, height: 20, backgroundColor: "var(--color-dark-border)" }}
    />
  )
}
