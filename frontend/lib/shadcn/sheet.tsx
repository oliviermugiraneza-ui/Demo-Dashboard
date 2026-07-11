import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../utils'

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const SheetCtx = React.createContext<{ open: boolean; close: () => void }>({
  open: false, close: () => {},
})

export function Sheet({ open = false, onOpenChange, children }: SheetProps) {
  const close = () => onOpenChange?.(false)
  return (
    <SheetCtx.Provider value={{ open, close }}>
      {children}
    </SheetCtx.Provider>
  )
}

export function SheetTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

interface SheetContentProps {
  children: React.ReactNode
  className?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
}

export function SheetContent({ children, className, side = 'right' }: SheetContentProps) {
  const { open, close } = React.useContext(SheetCtx)
  if (!open) return null

  const sideClass = {
    right:  'right-0 top-0 h-full w-[480px] max-w-full',
    left:   'left-0 top-0 h-full w-[480px] max-w-full',
    top:    'top-0 left-0 right-0 h-auto',
    bottom: 'bottom-0 left-0 right-0 h-auto',
  }[side]

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={close} />
      <div
        className={cn(
          'fixed z-50 bg-white shadow-2xl overflow-y-auto',
          sideClass,
          className,
        )}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </>
  )
}

export function SheetHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-6 pt-6 pb-4 border-b border-gray-100', className)}>{children}</div>
}

export function SheetTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold text-gray-900', className)}>{children}</h2>
}
