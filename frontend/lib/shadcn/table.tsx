import * as React from 'react'
import { cn } from '../utils'

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)}>{children}</table>
    </div>
  )
}

export function TableHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <thead className={cn('[&_tr]:border-b', className)}>{children}</thead>
}

export function TableBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)}>{children}</tbody>
}

export function TableRow({
  children, className, onClick, style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: (() => void) | ((event: unknown) => void) | undefined
}) {
  return (
    <tr
      onClick={onClick as React.MouseEventHandler<HTMLTableRowElement> | undefined}
      style={style}
      className={cn('border-b border-gray-100 transition-colors hover:bg-gray-50', onClick && 'cursor-pointer', className)}
    >
      {children}
    </tr>
  )
}

export function TableHead({
  children, className, style, onClick,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: ((event: unknown) => void) | (() => void)
}) {
  return (
    <th
      style={style}
      onClick={onClick as React.MouseEventHandler<HTMLTableCellElement> | undefined}
      className={cn('h-10 px-4 text-left align-middle text-xs font-semibold text-gray-500 uppercase tracking-wider', className)}
    >
      {children}
    </th>
  )
}

export function TableCell({
  children, className, colSpan, style,
}: {
  children?: React.ReactNode
  className?: string
  colSpan?: number
  style?: React.CSSProperties
}) {
  return (
    <td className={cn('px-4 py-3 align-middle text-sm text-gray-700', className)} colSpan={colSpan} style={style}>
      {children}
    </td>
  )
}
