import {
  demoRequests,
  postDemoSessions,
  operationFeedback,
  leadBand,
  type DemoRequest,
  type PostDemoSession,
  type OperationFeedback,
  type GeoCode,
} from './sampleData'

// ─── Month helpers ────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return MONTH_LABELS[d.getMonth()] ?? ''
}

// ─── aggregateDemosByMonth ────────────────────────────────────────────────────

export interface MonthBucket {
  month: string      // 'Jan', 'Feb', …
  key: string        // '2025-01'
  total: number
  reviewed: number
  canceled: number
  needsReview: number
}

export function aggregateDemosByMonth(
  demos: DemoRequest[] = demoRequests,
): MonthBucket[] {
  const map = new Map<string, MonthBucket>()

  for (const d of demos) {
    if (!d.demo_date) continue
    const key = monthKey(d.demo_date)
    if (!map.has(key)) {
      map.set(key, { month: monthLabel(d.demo_date), key, total:0, reviewed:0, canceled:0, needsReview:0 })
    }
    const bucket = map.get(key)!
    bucket.total++
    if (d.status === 'APPROVED') bucket.reviewed++
    else if (d.status === 'CANCELED') bucket.canceled++
    else bucket.needsReview++
  }

  return Array.from(map.values()).sort((a,b) => a.key.localeCompare(b.key))
}

// ─── aggregateByGeo ───────────────────────────────────────────────────────────

export interface GeoBucket {
  geo: GeoCode
  count: number
  pct: number
}

export function aggregateByGeo(
  demos: DemoRequest[] = demoRequests,
): GeoBucket[] {
  const map = new Map<GeoCode, number>()
  const geos: GeoCode[] = ['UK','US','JP','DE']
  for (const g of geos) map.set(g, 0)
  for (const d of demos) {
    map.set(d.geo, (map.get(d.geo) ?? 0) + 1)
  }
  const total = demos.length || 1
  return geos.map(geo => ({
    geo,
    count: map.get(geo) ?? 0,
    pct: Math.round(((map.get(geo) ?? 0) / total) * 100),
  }))
}

// ─── aggregateByType ──────────────────────────────────────────────────────────

export interface TypeBucket {
  type: string
  count: number
  pct: number
}

export function aggregateByType(
  demos: DemoRequest[] = demoRequests,
): TypeBucket[] {
  const map = new Map<string, number>()
  for (const d of demos) {
    map.set(d.type, (map.get(d.type) ?? 0) + 1)
  }
  const total = demos.length || 1
  return Array.from(map.entries())
    .map(([type, count]) => ({ type, count, pct: Math.round((count/total)*100) }))
    .sort((a,b) => b.count - a.count)
}

// ─── aggregateReadiness ───────────────────────────────────────────────────────

export interface ReadinessBucket {
  band: string
  key: string
  color: string
  count: number
}

export function aggregateReadiness(
  demos: DemoRequest[] = demoRequests,
): { buckets: ReadinessBucket[]; rate: number } {
  const map = new Map<string, ReadinessBucket>()
  const eligible = demos.filter(d => d.status !== 'CANCELED' && d.status !== 'DELETED')

  for (const d of eligible) {
    const lb = leadBand(d.lead_days)
    if (!map.has(lb.key)) {
      map.set(lb.key, { band: lb.label, key: lb.key, color: lb.color, count: 0 })
    }
    map.get(lb.key)!.count++
  }

  const rate = eligible.length > 0
    ? Math.round((eligible.filter(d => d.readiness_date).length / eligible.length) * 100)
    : 0

  const order = ['critical','short','good','excellent','unknown']
  const buckets = order
    .filter(k => map.has(k))
    .map(k => map.get(k)!)

  return { buckets, rate }
}

// ─── aggregateAvgSatisfaction ─────────────────────────────────────────────────

export interface SatisfactionBucket {
  geo: GeoCode
  avg: number
  count: number
}

export function aggregateAvgSatisfaction(
  feedback: OperationFeedback[] = operationFeedback,
): { overall: number; byGeo: SatisfactionBucket[] } {
  const geoMap = new Map<GeoCode, number[]>()
  const geos: GeoCode[] = ['UK','US','JP','DE']
  for (const g of geos) geoMap.set(g, [])

  for (const f of feedback) {
    geoMap.get(f.geo)?.push(f.satisfaction_score)
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a,b) => a+b, 0) / arr.length) * 10) / 10 : 0

  const allScores = feedback.map(f => f.satisfaction_score)
  const overall = avg(allScores)

  const byGeo: SatisfactionBucket[] = geos.map(geo => ({
    geo,
    avg: avg(geoMap.get(geo) ?? []),
    count: (geoMap.get(geo) ?? []).length,
  }))

  return { overall, byGeo }
}

// ─── aggregatePostDemoByModel ─────────────────────────────────────────────────

export interface ModelBucket {
  model: string
  count: number
  avgInterventions: number
  avgFeatureRating: number
}

export function aggregatePostDemoByModel(
  sessions: PostDemoSession[] = postDemoSessions,
): ModelBucket[] {
  const map = new Map<string, { sessions: PostDemoSession[] }>()
  for (const s of sessions) {
    if (!map.has(s.model)) map.set(s.model, { sessions: [] })
    map.get(s.model)!.sessions.push(s)
  }
  return Array.from(map.entries()).map(([model, { sessions: ss }]) => ({
    model,
    count: ss.length,
    avgInterventions: Math.round((ss.reduce((a,b) => a + b.total_interventions, 0) / ss.length) * 10) / 10,
    avgFeatureRating: Math.round((ss.reduce((a,b) => a + b.feature_rating, 0) / ss.length) * 10) / 10,
  }))
}

// ─── aggregateInterventions ───────────────────────────────────────────────────

export interface InterventionBucket {
  type: string
  label: string
  count: number
}

const INTERVENTION_LABELS: Record<string, string> = {
  comfort_stop: 'Comfort Stop',
  disengagement: 'Disengagement',
  takeover: 'Takeover',
  collision_avoidance: 'Collision Avoidance',
  blue_light: 'Blue Light',
  power_cycle: 'Power Cycle',
  ui_crash: 'UI Crash',
  gps_loss: 'GPS Loss',
}

export function aggregateInterventions(
  sessions: PostDemoSession[] = postDemoSessions,
): InterventionBucket[] {
  const map = new Map<string, number>()
  for (const s of sessions) {
    for (const [type, count] of Object.entries(s.interventions)) {
      if (count && count > 0) {
        map.set(type, (map.get(type) ?? 0) + count)
      }
    }
  }
  return Array.from(map.entries())
    .map(([type, count]) => ({ type, label: INTERVENTION_LABELS[type] ?? type, count }))
    .sort((a,b) => b.count - a.count)
}

// ─── aggregateIssues ──────────────────────────────────────────────────────────

export interface IssueBucket {
  issue: string
  count: number
}

export function aggregateIssues(
  sessions: PostDemoSession[] = postDemoSessions,
): IssueBucket[] {
  const map = new Map<string, number>()
  for (const s of sessions) {
    for (const issue of s.active_issues_list) {
      if (issue.trim()) {
        map.set(issue.trim(), (map.get(issue.trim()) ?? 0) + 1)
      }
    }
  }
  return Array.from(map.entries())
    .map(([issue, count]) => ({ issue, count }))
    .sort((a,b) => b.count - a.count)
}

// ─── aggregateGeoTrend ────────────────────────────────────────────────────────

export interface GeoTrendPoint {
  month: string
  key: string
  UK: number
  US: number
  JP: number
  DE: number
  ST: number
}

export function aggregateGeoTrend(
  demos: DemoRequest[] = demoRequests,
): GeoTrendPoint[] {
  const map = new Map<string, GeoTrendPoint>()
  for (const d of demos) {
    if (!d.demo_date) continue
    const key = monthKey(d.demo_date)
    if (!map.has(key)) {
      map.set(key, { month: monthLabel(d.demo_date), key, UK:0, US:0, JP:0, DE:0, ST:0 })
    }
    const pt = map.get(key)!
    pt[d.geo]++
  }
  return Array.from(map.values()).sort((a,b) => a.key.localeCompare(b.key))
}
