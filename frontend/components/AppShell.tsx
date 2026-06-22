import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  BarChart2,
  ClipboardList,
  Calendar,
  ActivitySquare,
  Navigation2,
  Calculator,
  FileText,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Zap,
} from 'lucide-react'

// ─── Nav Config ───────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  path: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',           path: '/home',           icon: <Home           size={18} /> },
  { label: 'Demo KPIs',      path: '/',               icon: <BarChart2      size={18} /> },
  { label: 'Demo Request',   path: '/demo-request',   icon: <FileText       size={18} /> },
  { label: 'Demo Tracker',   path: '/tracker',        icon: <ClipboardList  size={18} /> },
  { label: 'Demo Approval',  path: '/demo-approval',  icon: <Navigation2    size={18} /> },
  { label: 'Demo Calendar',  path: '/calendar',       icon: <Calendar       size={18} /> },
  { label: 'Post Demo',      path: '/post-demo',      icon: <ActivitySquare size={18} /> },
  { label: 'Demo Cost',      path: '/cost',           icon: <Calculator     size={18} /> },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: ReactNode
  pageTitle?: string
  headerControls?: ReactNode
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppShell({ children, pageTitle, headerControls }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  // Format last synced
  const now = new Date()
  const syncTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const sidebarW = collapsed ? 72 : 240

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col flex-shrink-0 border-r border-gray-200 bg-white transition-all duration-200"
        style={{ width: sidebarW }}
      >
        {/* Brand */}
        <div
          className="flex items-center border-b border-gray-100"
          style={{ height: 60, padding: collapsed ? '0 18px' : '0 20px' }}
        >
          {/* Logo icon */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)' }}
          >
            <Zap size={16} />
          </div>

          {!collapsed && (
            <span className="ml-2.5 font-semibold text-[#0F172A] text-sm leading-tight whitespace-nowrap">
              Wayve Demo Ops
            </span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_ITEMS.map(item => {
            const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3 rounded-lg mb-0.5 transition-all duration-150
                  ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                  ${active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-[#64748B] hover:bg-gray-50 hover:text-[#0F172A]'}
                `}
              >
                <span className={`flex-shrink-0 ${active ? 'text-blue-600' : ''}`}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
                {active && !collapsed && (
                  <span className="ml-auto w-1.5 h-5 rounded-full bg-blue-600" />
                )}
              </Link>
            )
          })}

          {/* Admin nav item */}
          {(() => {
            const active = location.pathname.startsWith('/admin')
            return (
              <>
                <div className="mx-2 my-2 border-t border-gray-100" />
                <Link
                  to="/admin"
                  title={collapsed ? 'Admin' : undefined}
                  className={`
                    flex items-center gap-3 rounded-lg mb-0.5 transition-all duration-150
                    ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                    ${active
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-[#64748B] hover:bg-gray-50 hover:text-[#0F172A]'}
                  `}
                >
                  <span className={`flex-shrink-0 ${active ? 'text-blue-600' : ''}`}>
                    <Settings2 size={18} />
                  </span>
                  {!collapsed && <span className="text-sm font-medium truncate">Admin</span>}
                  {active && !collapsed && <span className="ml-auto w-1.5 h-5 rounded-full bg-blue-600" />}
                </Link>
              </>
            )
          })()}
        </nav>

        {/* Live Sync Indicator */}
        <div
          className="border-t border-gray-100 flex items-center gap-2"
          style={{ padding: collapsed ? '14px 0' : '14px 16px', justifyContent: collapsed ? 'center' : undefined }}
        >
          <span className="relative flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 block" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute inset-0 animate-ping opacity-60" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Wifi size={11} className="text-emerald-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-emerald-600">Live</span>
              </div>
              <p className="text-[10px] text-[#64748B] truncate">Synced {syncTime}</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="border-t border-gray-100 flex items-center justify-center py-3
                     text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <span className="flex items-center gap-2 text-xs text-[#64748B]">
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </span>
          )}
        </button>
      </aside>

      {/* ── Content Area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Sticky page header */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200 z-10"
                style={{ height: 60 }}>
          <div className="flex items-center justify-between h-full px-6">
            <h1 className="text-lg font-semibold text-[#0F172A] truncate">
              {pageTitle ?? 'Wayve Demo Ops'}
            </h1>
            {headerControls && (
              <div className="flex items-center gap-3 flex-shrink-0">
                {headerControls}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#F8FAFC' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
