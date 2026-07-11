import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from './lib/shadcn/sonner'
import AppShell from './components/AppShell'
import { HeaderBadgeProvider } from './context/HeaderBadgeContext'
import HomePage         from './pages/HomePage'
import KPIPage          from './pages/KPIPage'
import TrackerPage      from './pages/TrackerPage'
import CalendarPage     from './pages/CalendarPage'
import PostDemoPage     from './pages/PostDemoPage'
import CockpitPage      from './pages/CockpitPage'
import CostPage         from './pages/CostPage'
import DemoRequestPage  from './pages/DemoRequestPage'
import AdminConfigPage     from './pages/AdminConfigPage'
import BacklogPage         from './pages/BacklogPage'
import NotificationsPage   from './pages/NotificationsPage'

const PAGE_TITLES: Record<string, string> = {
  '/home':                    'HOME',
  '/':                        'KPIs',
  '/backlog':                 'BACKLOG',
  '/tracker':                 'TRACKER',
  '/calendar':                'CALENDAR',
  '/post-demo':               'POST DEMO',
  '/demo-approval':           'APPROVAL',
  '/cost':                    'COST',
  '/demo-request':            'REQUEST',
  '/admin':                   'ADMIN',
  '/settings/notifications':  'NOTIFICATIONS',
}

function AppContent() {
  const location = useLocation()

  const pageTitle = PAGE_TITLES[location.pathname]
    ?? (location.pathname.startsWith('/demo-request') ? 'REQUEST'
       : location.pathname.startsWith('/admin')        ? 'ADMIN'
       : location.pathname.startsWith('/backlog')      ? 'BACKLOG'
       : location.pathname.startsWith('/settings')     ? 'SETTINGS'
       : 'WAYVE DEMO OPS')

  return (
    <AppShell pageTitle={pageTitle}>
      <Routes>
        <Route path="/home"           element={<HomePage />} />
        <Route path="/backlog"        element={<BacklogPage />} />
        <Route path="/"               element={<KPIPage />} />
        <Route path="/tracker"        element={<TrackerPage />} />
        <Route path="/calendar"       element={<CalendarPage />} />
        <Route path="/post-demo"      element={<PostDemoPage />} />
        <Route path="/demo-approval"  element={<CockpitPage />} />
        <Route path="/cost"           element={<CostPage />} />
        <Route path="/demo-request/*"          element={<DemoRequestPage />} />
        <Route path="/admin"                   element={<AdminConfigPage />} />
        <Route path="/settings/notifications"  element={<NotificationsPage />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <HeaderBadgeProvider>
      <AppContent />
      <Toaster position="bottom-right" richColors />
    </HeaderBadgeProvider>
  )
}
