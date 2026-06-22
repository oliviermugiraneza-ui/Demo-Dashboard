import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../utils'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const DialogCtx = React.createContext<{ open: boolean; close: () => void }>({
  open: false, close: () => {},
})

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const close = () => onOpenChange?.(false)
  return (
    <DialogCtx.Provider value={{ open, close }}>
      {children}
    </DialogCtx.Provider>
  )
}

export function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, close } = React.useContext(DialogCtx)
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />
      <div
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-lg bg-white rounded-xl shadow-xl p-6',
          'max-h-[90vh] overflow-y-auto',
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

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold text-gray-900', className)}>{children}</h2>
}

export function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-gray-500 mt-1', className)}>{children}</p>
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100', className)}>
      {children}
    </div>
  )
}
