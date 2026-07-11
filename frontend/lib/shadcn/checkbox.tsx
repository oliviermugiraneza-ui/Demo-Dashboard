import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '../utils'

interface CheckboxProps {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
}

export function Checkbox({ id, checked, onCheckedChange, className, disabled }: CheckboxProps) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'h-4 w-4 rounded border border-gray-300 flex items-center justify-center flex-shrink-0 transition-colors',
        checked ? 'bg-[#2563EB] border-[#2563EB]' : 'bg-white',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
  )
}
