import * as React from 'react'

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

const CollapsibleCtx = React.createContext<{
  open: boolean
  toggle: () => void
}>({ open: true, toggle: () => {} })

export function Collapsible({ open, onOpenChange, children, className }: CollapsibleProps) {
  const [internal, setInternal] = React.useState(open ?? true)
  const controlled = open !== undefined
  const isOpen = controlled ? open! : internal

  const toggle = () => {
    if (!controlled) setInternal(v => !v)
    onOpenChange?.(!isOpen)
  }

  return (
    <CollapsibleCtx.Provider value={{ open: isOpen, toggle }}>
      <div className={className}>{children}</div>
    </CollapsibleCtx.Provider>
  )
}

export function CollapsibleTrigger({
  children, className, asChild,
}: {
  children: React.ReactNode
  className?: string
  asChild?: boolean
}) {
  const { toggle } = React.useContext(CollapsibleCtx)
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      onClick: toggle,
    })
  }
  return (
    <div onClick={toggle} className={className} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  )
}

export function CollapsibleContent({ children }: { children: React.ReactNode }) {
  const { open } = React.useContext(CollapsibleCtx)
  if (!open) return null
  return <>{children}</>
}
