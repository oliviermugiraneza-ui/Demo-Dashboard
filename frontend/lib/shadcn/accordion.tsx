import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../utils'

interface AccordionProps {
  type?: 'single' | 'multiple'
  defaultValue?: string | string[]
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  children: React.ReactNode
  className?: string
  collapsible?: boolean
}

const AccordionCtx = React.createContext<{
  openItems: Set<string>
  toggle: (value: string) => void
}>({ openItems: new Set(), toggle: () => {} })

export function Accordion({
  type = 'single',
  defaultValue,
  children,
  className,
}: AccordionProps) {
  const initial = React.useMemo(() => {
    if (!defaultValue) return new Set<string>()
    return new Set<string>(Array.isArray(defaultValue) ? defaultValue : [defaultValue])
  }, [])
  const [openItems, setOpenItems] = React.useState<Set<string>>(initial)

  const toggle = (value: string) => {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        if (type === 'single') next.clear()
        next.add(value)
      }
      return next
    })
  }

  return (
    <AccordionCtx.Provider value={{ openItems, toggle }}>
      <div className={cn('divide-y divide-gray-100', className)}>{children}</div>
    </AccordionCtx.Provider>
  )
}

const ItemCtx = React.createContext<string>('')

export function AccordionItem({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <ItemCtx.Provider value={value}>
      <div className={className}>{children}</div>
    </ItemCtx.Provider>
  )
}

export function AccordionTrigger({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const value = React.useContext(ItemCtx)
  const { openItems, toggle } = React.useContext(AccordionCtx)
  const open = openItems.has(value)

  return (
    <button
      type="button"
      onClick={() => toggle(value)}
      className={cn(
        'flex w-full items-center justify-between py-3 text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors',
        className,
      )}
    >
      {children}
      <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
    </button>
  )
}

export function AccordionContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const value = React.useContext(ItemCtx)
  const { openItems } = React.useContext(AccordionCtx)
  if (!openItems.has(value)) return null
  return <div className={cn('pb-3 text-sm text-gray-600', className)}>{children}</div>
}
