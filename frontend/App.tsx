import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from './lib/shadcn/sonner'
import AppShell from './components/AppShell'
import HomePage         from './pages/HomePage'
import KPIPage          from './pages/KPIPage'
import TrackerPage      from './pages/TrackerPage'
import CalendarPage     from './pages/CalendarPage'
import PostDemoPage     from './pages/PostDemoPage'
import CockpitPage      from './pages/CockpitPage'
import CostPage         from './pages/CostPage'
import DemoRequestPage  from './pages/DemoRequestPage'
import AdminConfigPage  from './pages/AdminConfigPage'

const PAGE_TITLES: Record<string, string> = {
  '/home':         'Home',
  '/':             'Demo KPIs',
  '/tracker':      'Demo Tracker',
  '/calendar':     'Demo Calendar',
  '/post-demo':    'Post Demo Analytics',
  '/demo-approval': 'Demo Approval',
  '/cost':         'Demo Cost',
  '/demo-request': 'Demo Request',
  '/admin':        'Admin',
}

function AppContent() {
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname]
    ?? (location.pathname.startsWith('/demo-request') ? 'Demo Request'
       : location.pathname.startsWith('/admin') ? 'Admin'
       : 'Wayve Demo Ops')

  return (
    <AppShell pageTitle={pageTitle}>
      <Routes>
        <Route path="/home"           element={<HomePage />} />
        <Route path="/"               element={<KPIPage />} />
        <Route path="/tracker"        element={<TrackerPage />} />
        <Route path="/calendar"       element={<CalendarPage />} />
        <Route path="/post-demo"      element={<PostDemoPage />} />
        <Route path="/demo-approval"  element={<CockpitPage />} />
        <Route path="/cost"           element={<CostPage />} />
        <Route path="/demo-request/*" element={<DemoRequestPage />} />
        <Route path="/admin"           element={<AdminConfigPage />} />
      </Routes>
    </AppShell>
  )
}

export default function App() {
  return (
    <>
      <AppContent />
      <Toaster position="bottom-right" richColors />
    </>
  )
}
