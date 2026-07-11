import { useState, useCallback } from 'react'

export interface HomeKPIs {
  proposed:       number
  pendingApproval: number
  approved:       number
  totalGuests:    number
  cancelled:      number
}

export interface UpcomingDemo {
  demo_ref:     string | null
  type:         string | null
  geo:          string | null
  demo_date:    string | null
  start_time:   string | null
  host:         string | null
  organization: string | null
  status:       string
}

export interface ActivityRow {
  demo_ref:  string | null
  host:      string | null
  type:      string | null
  geo:       string | null
  demo_date: string | null
  status:    string | null
}

export interface HomeData {
  kpis:          HomeKPIs
  geoCounts:     Record<string, number>
  upcoming:      UpcomingDemo[]
  recentActivity: ActivityRow[]
}

export function useGetHomeData() {
  const [data,    setData]    = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetch_ = useCallback(async (geo: string, timeframe = 'this_week') => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (geo && geo !== 'ALL') p.set('geo', geo)
      p.set('timeframe', timeframe)
      const res  = await fetch(`/api/home?${p.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { ok: boolean } & HomeData & { error?: string }
      if (!json.ok) throw new Error(json.error ?? 'API error')
      setData({
        kpis:           json.kpis,
        geoCounts:      json.geoCounts,
        upcoming:       json.upcoming,
        recentActivity: json.recentActivity,
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch_ }
}
