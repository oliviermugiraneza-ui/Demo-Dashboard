import { useState, useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useHeaderBadge } from '../context/HeaderBadgeContext'
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
  Plus,
  Bell,
  Layers,
  BellRing,
} from 'lucide-react'

// ─── Nav Config ───────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  path: string
  icon: ReactNode
}

// Primary nav items (shown above the divider)
const NAV_ITEMS: NavItem[] = [
  { label: 'Home',     path: '/home',          icon: <Home           size={18} /> },
  { label: 'Calendar', path: '/calendar',      icon: <Calendar       size={18} /> },
  { label: 'Request',  path: '/demo-request',  icon: <FileText       size={18} /> },
  { label: 'Backlog',  path: '/backlog',       icon: <Layers         size={18} /> },
  { label: 'Approval', path: '/demo-approval', icon: <Navigation2    size={18} /> },
  { label: 'Post Demo', path: '/post-demo',    icon: <ActivitySquare size={18} /> },
  { label: 'KPIs',     path: '/',             icon: <BarChart2      size={18} /> },
]

// Secondary nav items (shown below the divider alongside Admin/Notifications)
const SECONDARY_NAV_ITEMS: NavItem[] = [
  { label: 'Tracker',  path: '/tracker',       icon: <ClipboardList  size={18} /> },
  { label: 'Cost',     path: '/cost',          icon: <Calculator     size={18} /> },
]

const PAGE_SUBTITLES: Record<string, string> = {
  '/home':                   'Overview of demo operations',
  '/':                       'KPI metrics & analytics',
  '/backlog':                'Potential demos before formal request submission',
  '/tracker':                'Upcoming & completed demos',
  '/calendar':               'Schedule at a glance',
  '/post-demo':              'Satisfaction & feedback data',
  '/demo-approval':          'Review & approve requests',
  '/cost':                   'Budget & cost tracking',
  '/demo-request':           'Submit and track your requests',
  '/admin':                  'System configuration',
  '/settings/notifications': 'Test and monitor notification channels',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: ReactNode
  pageTitle?: string
  headerControls?: ReactNode
}

// ─── Live Clock ───────────────────────────────────────────────────────────────

function useLiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppShell({ children, pageTitle }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const now = useLiveClock()
  const { badge } = useHeaderBadge()

  const syncTime  = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const sidebarW  = collapsed ? 60 : 200

  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })

  const subtitle = PAGE_SUBTITLES[location.pathname]
    ?? (location.pathname.startsWith('/demo-request') ? 'Submit and track your demos'
       : location.pathname.startsWith('/admin')        ? 'System configuration'
       : location.pathname.startsWith('/settings')     ? 'System settings'
       : '')

  const isRequestOrApproval = location.pathname.startsWith('/demo-request')
    || location.pathname.startsWith('/demo-approval')
    || location.pathname.startsWith('/backlog')
    || location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/settings/notifications')
    || location.pathname.startsWith('/cost')
    || location.pathname.startsWith('/post-demo')

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 border-r border-gray-100 bg-white transition-all duration-200"
        style={{ width: sidebarW }}
      >
        {/* Brand */}
        <div
          className="flex items-center border-b border-gray-100"
          style={{ height: 64, padding: collapsed ? '0 18px' : '0 20px' }}
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #2563EB 100%)' }}
          >
            <Zap size={16} />
          </div>
          {!collapsed && (
            <span className="ml-2.5 text-sm font-bold text-gray-900 leading-tight whitespace-nowrap">
              Wayve Demo Ops
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_ITEMS.map(item => {
            const active = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={[
                  'flex items-center gap-3 rounded-xl mb-0.5 transition-all duration-150',
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                  active
                    ? 'bg-blue-50 text-[#2563EB]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                ].join(' ')}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
                {active && !collapsed && (
                  <span className="ml-auto w-1.5 h-5 rounded-full bg-[#2563EB]" />
                )}
              </Link>
            )
          })}

          {/* Secondary section — divider + Admin + Tracker + Cost + Notifications */}
          {(() => {
            const adminActive = location.pathname.startsWith('/admin')
            const notifActive = location.pathname.startsWith('/settings/notifications')
            return (
              <>
                <div className="mx-2 my-2 border-t border-gray-100" />

                {/* Admin */}
                <Link
                  to="/admin"
                  title={collapsed ? 'Admin' : undefined}
                  className={[
                    'flex items-center gap-3 rounded-xl mb-0.5 transition-all duration-150',
                    collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                    adminActive ? 'bg-blue-50 text-[#2563EB]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                  ].join(' ')}
                >
                  <span className="flex-shrink-0"><Settings2 size={18} /></span>
                  {!collapsed && <span className="text-sm font-medium truncate">Admin</span>}
                  {adminActive && !collapsed && <span className="ml-auto w-1.5 h-5 rounded-full bg-[#2563EB]" />}
                </Link>

                {/* Tracker + Cost */}
                {SECONDARY_NAV_ITEMS.map(item => {
                  const active = location.pathname.startsWith(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={[
                        'flex items-center gap-3 rounded-xl mb-0.5 transition-all duration-150',
                        collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                        active ? 'bg-blue-50 text-[#2563EB]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                      ].join(' ')}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
                      {active && !collapsed && <span className="ml-auto w-1.5 h-5 rounded-full bg-[#2563EB]" />}
                    </Link>
                  )
                })}

                {/* Notifications */}
                <Link
                  to="/settings/notifications"
                  title={collapsed ? 'Notifications' : undefined}
                  className={[
                    'flex items-center gap-3 rounded-xl mb-0.5 transition-all duration-150',
                    collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
                    notifActive ? 'bg-blue-50 text-[#2563EB]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                  ].join(' ')}
                >
                  <span className="flex-shrink-0"><BellRing size={18} /></span>
                  {!collapsed && <span className="text-sm font-medium truncate">Notifications</span>}
                  {notifActive && !collapsed && <span className="ml-auto w-1.5 h-5 rounded-full bg-[#2563EB]" />}
                </Link>
              </>
            )
          })()}
        </nav>

        {/* Live sync */}
        <div
          className="border-t border-gray-100 flex items-center gap-2"
          style={{ padding: collapsed ? '14px 0' : '14px 16px', justifyContent: collapsed ? 'center' : undefined }}
        >
          <span className="relative flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 block" />
            <span className="w-2 h-2 rounded-full bg-green-500 absolute inset-0 animate-ping opacity-60" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Wifi size={11} className="text-green-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-green-600">Live</span>
              </div>
              <p className="text-[10px] text-gray-400 truncate">Synced {syncTime}</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="border-t border-gray-100 flex items-center justify-center py-3
                     text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <span className="flex items-center gap-2 text-xs text-gray-400">
              <ChevronLeft size={16} />
              <span>Collapse</span>
            </span>
          )}
        </button>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Global Top Bar ── */}
        <header className="flex-shrink-0 flex items-center gap-4 px-6 bg-white border-b border-gray-100"
          style={{ height: 64 }}>

          {/* Page title */}
          <div className="min-w-0 flex-shrink-0">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              {pageTitle ?? 'WAYVE DEMO OPS'}
            </h1>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 ml-auto flex-shrink-0">

            {/* Action badge slot — populated by page-level components via context */}
            {badge && <div className="flex-shrink-0">{badge}</div>}

            {/* Clock + Date */}
            <div className="text-right leading-none hidden sm:block">
              <p className="text-sm font-bold text-gray-900">{timeStr}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{dateStr}</p>
            </div>

            {/* Notification bell */}
            <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Notifications">
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>

            {/* New Request button */}
            {!isRequestOrApproval && (
              <Link
                to="/demo-request/request"
                className="flex items-center gap-1.5 text-sm font-semibold text-white
                           bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors rounded-full px-4 py-2"
              >
                <Plus className="w-4 h-4" />
                New Request
              </Link>
            )}

            {/* User avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center
                         text-white text-xs font-bold flex-shrink-0 select-none cursor-default"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #2563EB)' }}
              title="Olivier Mugiraneza"
            >
              OM
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          {children}
        </main>
      </div>
    </div>
  )
}
