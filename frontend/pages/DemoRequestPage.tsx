import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

const RequestHome = lazy(() => import('./demoRequest/RequestHome'))
const RequestForm = lazy(() => import('./demoRequest/RequestForm'))

// ─── Loading fallback ─────────────────────────────────────────────────────────

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] text-gray-400 text-sm gap-2">
      <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-[#2563EB] rounded-full" />
      Loading…
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DemoRequestPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route index element={<Navigate to="request" replace />} />
        <Route path="request"       element={<RequestHome />} />
        <Route path="request/:type" element={<RequestForm />} />
      </Routes>
    </Suspense>
  )
}
