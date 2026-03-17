import type React from "react"

interface RangeSliderProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value" | "min" | "max" | "step" | "type"
  > {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Accessible label applied as aria-label */
  label?: string
  /** Show the numeric value to the right of the slider */
  showValue?: boolean
  className?: string
}

/**
 * Styled range input that applies the `editor-range` CSS class from index.css.
 * The filled track portion is driven by `--range-fill` which is inherited by
 * the `::-webkit-slider-runnable-track` pseudo-element.
 */
export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = false,
  className = "",
  ...props
}: RangeSliderProps) {
  const fillPercent = ((value - min) / (max - min)) * 100

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={e => onChange(Number(e.target.value))}
        className="editor-range flex-1 cursor-pointer"
        style={{ "--range-fill": `${fillPercent}%` } as React.CSSProperties}
        {...props}
      />
      {showValue && (
        <span className="font-mono text-xs text-muted tabular-nums w-8 text-right shrink-0">
          {Math.round(value)}
        </span>
      )}
    </div>
  )
}
