import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../utils'

// ─── Context ──────────────────────────────────────────────────────────────────

interface SelectCtx {
  value: string
  open: boolean
  setOpen: (v: boolean) => void
  onValueChange?: (v: string) => void
}

const Ctx = React.createContext<SelectCtx>({
  value: '', open: false, setOpen: () => {}, onValueChange: undefined,
})

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export function Select({ value, defaultValue = '', onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [internal, setInternal] = React.useState(defaultValue)
  const controlled = value !== undefined
  const current = controlled ? (value ?? '') : internal

  const handleChange = (v: string) => {
    if (!controlled) setInternal(v)
    onValueChange?.(v)
    setOpen(false)
  }

  return (
    <Ctx.Provider value={{ value: current, open, setOpen, onValueChange: handleChange }}>
      <div className="relative">{children}</div>
    </Ctx.Provider>
  )
}

// ─── SelectTrigger ────────────────────────────────────────────────────────────

interface SelectTriggerProps {
  className?: string
  children?: React.ReactNode
}

export function SelectTrigger({ className, children }: SelectTriggerProps) {
  const { open, setOpen } = React.useContext(Ctx)
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex items-center justify-between w-full rounded-lg border border-gray-200 bg-white',
        'px-3 text-sm text-gray-900 shadow-sm transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-blue-500',
        'h-9',
        className,
      )}
    >
      <span className="truncate">{children}</span>
      <ChevronDown className={cn('w-4 h-4 text-gray-400 flex-shrink-0 ml-1 transition-transform', open && 'rotate-180')} />
    </button>
  )
}

// ─── SelectValue ─────────────────────────────────────────────────────────────

interface SelectValueProps {
  placeholder?: string
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = React.useContext(Ctx)

  return (
    <span className={value ? 'text-gray-900' : 'text-gray-400'}>
      {value || placeholder || ''}
    </span>
  )
}

// ─── SelectContent ────────────────────────────────────────────────────────────

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

export function SelectContent({ children, className }: SelectContentProps) {
  const { open, setOpen } = React.useContext(Ctx)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 mt-1 w-full min-w-[8rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg',
        'max-h-60 overflow-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}

// ─── SelectItem ───────────────────────────────────────────────────────────────

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function SelectItem({ value, children, className }: SelectItemProps) {
  const { value: current, onValueChange } = React.useContext(Ctx)
  const selected = current === value

  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={() => onValueChange?.(value)}
      className={cn(
        'px-3 py-2 text-sm cursor-pointer transition-colors',
        selected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900 hover:bg-gray-50',
        className,
      )}
    >
      {children}
    </div>
  )
}
