import { createContext, useContext, useState, type ReactNode } from 'react'

interface BadgeCtx {
  badge: ReactNode
  setBadge: (n: ReactNode) => void
}

const Ctx = createContext<BadgeCtx>({ badge: null, setBadge: () => {} })

export function HeaderBadgeProvider({ children }: { children: ReactNode }) {
  const [badge, setBadge] = useState<ReactNode>(null)
  return <Ctx.Provider value={{ badge, setBadge }}>{children}</Ctx.Provider>
}

export const useHeaderBadge = () => useContext(Ctx)
