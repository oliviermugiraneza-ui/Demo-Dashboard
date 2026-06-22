import { useState, useMemo } from 'react'
import { DollarSign, Save, Trash2, Upload, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Checkbox } from '../lib/shadcn/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../lib/shadcn/table'

// ─── Types & Constants ────────────────────────────────────────────────────────

type Geo = 'UK' | 'US' | 'DE'

interface Rates { opHr: number; leadHr: number; kmCost: number; hotel: number; meal: number }

const RATES: Record<Geo, Rates> = {
  UK: { opHr: 23, leadHr: 28, kmCost: 0.14, hotel: 125, meal: 65 },
  US: { opHr: 30, leadHr: 36, kmCost: 0.16, hotel: 200, meal: 85 },
  DE: { opHr: 25, leadHr: 30, kmCost: 0.15, hotel: 140, meal: 70 },
}

const CURRENCY: Record<Geo, { symbol: string; code: string }> = {
  UK: { symbol: '£', code: 'GBP' },
  US: { symbol: '$', code: 'USD' },
  DE: { symbol: '€', code: 'EUR' },
}

interface Estimate {
  id: string
  name: string
  geo: Geo
  total: number
  staffCost: number
  logCost: number
  fleetCost: number
  backupCost: number
  ts: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(symbol: string, n: number) {
  return `${symbol}${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function calcCosts(
  geo: Geo, vehicles: number, dist: number, ops: number, leads: number,
  travelH: number, hasBackup: boolean, backupDist: number, backupH: number,
) {
  const r = RATES[geo]
  const totalDuty = travelH + 2
  const teamSize = ops + leads
  const needsHotel = (travelH > 4 || totalDuty > 11) ? 1 : 0
  const meals = needsHotel ? 2 : (totalDuty > 6 ? 1 : 0)
  const staffCost = (ops * totalDuty * r.opHr) + (leads * totalDuty * r.leadHr)
  const logCost = (teamSize * needsHotel * r.hotel) + (teamSize * meals * r.meal)
  const fleetCost = vehicles * dist * r.kmCost
  const backupCost = hasBackup ? (backupH * r.opHr + backupDist * r.kmCost) : 0
  const grandTotal = staffCost + logCost + fleetCost + backupCost
  return { staffCost, logCost, fleetCost, backupCost, grandTotal, needsHotel, meals, totalDuty, teamSize }
}

// ─── Components ───────────────────────────────────────────────────────────────

function BreakdownRow({ label, value, symbol, accent = false }: {
  label: string; value: number; symbol: string; accent?: boolean
}) {
  if (value <= 0 && !accent) return null
  return (
    <div className={`flex items-center justify-between py-2 ${accent ? 'border-t-2 border-gray-200 mt-1 pt-3' : 'border-b border-gray-50'}`}>
      <span className={`text-sm ${accent ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`tabular-nums font-semibold ${accent ? 'text-base text-gray-900' : 'text-sm text-gray-800'}`}>
        {fmt(symbol, value)}
      </span>
    </div>
  )
}

function NumInput({ label, value, onChange, min = 0, step = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; step?: number; hint?: string
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-gray-600 mb-1 block">{label}</Label>
      <Input
        type="number" min={min} step={step}
        value={value === 0 ? '' : value}
        placeholder="0"
        className="h-9 text-sm"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CostPage() {
  // Form state
  const [estimateName, setEstimateName] = useState('')
  const [geo, setGeo] = useState<Geo>('UK')
  const [vehicles, setVehicles] = useState(1)
  const [dist, setDist] = useState(50)
  const [ops, setOps] = useState(2)
  const [leads, setLeads] = useState(1)
  const [travelH, setTravelH] = useState(3)
  const [hasBackup, setHasBackup] = useState(false)
  const [backupDist, setBackupDist] = useState(20)
  const [backupH, setBackupH] = useState(2)

  // Saved estimates
  const [estimates, setEstimates] = useState<Estimate[]>([])

  const { symbol } = CURRENCY[geo]
  const costs = useMemo(
    () => calcCosts(geo, vehicles, dist, ops, leads, travelH, hasBackup, backupDist, backupH),
    [geo, vehicles, dist, ops, leads, travelH, hasBackup, backupDist, backupH]
  )

  const handleSave = () => {
    if (!estimateName.trim()) { toast.error('Please enter an estimate name'); return }
    const est: Estimate = {
      id: Date.now().toString(),
      name: estimateName.trim(),
      geo,
      total: costs.grandTotal,
      staffCost: costs.staffCost,
      logCost: costs.logCost,
      fleetCost: costs.fleetCost,
      backupCost: costs.backupCost,
      ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
    setEstimates(prev => [est, ...prev])
    toast.success(`Estimate "${est.name}" saved`)
  }

  const handleLoad = (est: Estimate) => {
    setGeo(est.geo)
    toast.info(`Loaded "${est.name}" — rates applied`)
  }

  const handleDelete = (id: string) => {
    setEstimates(prev => prev.filter(e => e.id !== id))
    toast.success('Estimate deleted')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Left: Form Card ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Hero box */}
          <div className="relative px-6 py-6" style={{
            background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #0EA5E9 100%)'
          }}>
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />
            <p className="text-blue-100 text-xs font-semibold uppercase tracking-widest mb-1">Estimated Total Cost</p>
            <p className="text-white text-4xl font-bold tabular-nums tracking-tight">
              {fmt(symbol, costs.grandTotal)}
            </p>
            <p className="text-blue-200 text-sm mt-1.5">
              {CURRENCY[geo].code} · {ops + leads} staff · {vehicles} vehicle{vehicles !== 1 ? 's' : ''} · {costs.totalDuty}h duty
              {costs.needsHotel ? ` · hotel incl.` : ''}
              {costs.meals > 0 ? ` · ${costs.meals} meal${costs.meals > 1 ? 's' : ''}` : ''}
            </p>
          </div>

          {/* Form fields */}
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-600 mb-1 block">Estimate Name</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="e.g. BMW Munich VIP Demo"
                  value={estimateName}
                  onChange={e => setEstimateName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600 mb-1 block">Region / Currency</Label>
                <Select value={geo} onValueChange={v => setGeo(v as Geo)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UK">🇬🇧 UK (GBP)</SelectItem>
                    <SelectItem value="US">🇺🇸 US (USD)</SelectItem>
                    <SelectItem value="DE">🇩🇪 DE (EUR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumInput label="Main Demo Vehicles" value={vehicles} onChange={setVehicles} min={1} />
            </div>

            {/* Backup vehicle */}
            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={hasBackup}
                  onCheckedChange={v => setHasBackup(v === true)}
                />
                <span className="text-sm font-medium text-gray-700">Add Backup Vehicle</span>
              </label>
              {hasBackup && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <NumInput label="Backup Distance (km)" value={backupDist} onChange={setBackupDist} min={0} hint="Standby route distance" />
                  <NumInput label="Backup Work Hours" value={backupH} onChange={setBackupH} min={0} step={0.5} hint="Operator hours on standby" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumInput label="Distance per Vehicle (km)" value={dist} onChange={setDist} min={0} hint="One-way route distance" />
              <NumInput label="Travel Hours (Total Duty)" value={travelH} onChange={setTravelH} min={0} step={0.5} hint="+2h auto-added for prep/debrief" />
              <NumInput label="Operators" value={ops} onChange={setOps} min={0} hint={`${symbol}${RATES[geo].opHr}/hr`} />
              <NumInput label="Leads" value={leads} onChange={setLeads} min={0} hint={`${symbol}${RATES[geo].leadHr}/hr`} />
            </div>

            <Button className="w-full bg-[#0052FF] hover:bg-[#0040CC] text-white gap-2" onClick={handleSave}>
              <Save className="w-4 h-4" /> Save Estimate
            </Button>
          </div>
        </div>

        {/* ── Right: Preview Card ── */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Cost Breakdown</h3>
            </div>

            <div>
              <BreakdownRow label="Staff Costs" value={costs.staffCost} symbol={symbol} />
              <BreakdownRow label="Logistics (Hotel & Meals)" value={costs.logCost} symbol={symbol} />
              <BreakdownRow label="Fleet (Distance)" value={costs.fleetCost} symbol={symbol} />
              {hasBackup && <BreakdownRow label="Backup Vehicle" value={costs.backupCost} symbol={symbol} />}
              <BreakdownRow label="Grand Total" value={costs.grandTotal} symbol={symbol} accent />
            </div>

            {/* Rate card */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                Applied Rates ({CURRENCY[geo].code})
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                {[
                  ['Operator / hr', `${symbol}${RATES[geo].opHr}`],
                  ['Lead / hr', `${symbol}${RATES[geo].leadHr}`],
                  ['Distance / km', `${symbol}${RATES[geo].kmCost}`],
                  ['Hotel / night', `${symbol}${RATES[geo].hotel}`],
                  ['Meal allowance', `${symbol}${RATES[geo].meal}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="font-semibold text-gray-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Duty summary */}
            {(costs.needsHotel > 0 || costs.meals > 0) && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
                <span className="font-semibold">Logistics triggered: </span>
                {costs.needsHotel > 0 && 'Hotel required (duty &gt;11h or travel &gt;4h). '}
                {costs.meals > 0 && `${costs.meals} meal allowance${costs.meals > 1 ? 's' : ''} per person.`}
              </div>
            )}
          </div>

          {/* ── Saved Estimates ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-bold text-gray-900">Recent Estimates</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">{estimates.length}</span>
              </div>
            </div>
            {estimates.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Save className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No saved estimates yet.</p>
                <p className="text-xs text-gray-300 mt-0.5">Configure costs above and click Save Estimate.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs font-semibold text-gray-500 py-2.5">Name</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-500 py-2.5">Geo</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-500 py-2.5">Total</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-500 py-2.5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estimates.map(est => (
                      <TableRow key={est.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="py-2.5">
                          <p className="text-sm font-medium text-gray-900">{est.name}</p>
                          <p className="text-[10px] text-gray-400">{est.ts}</p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            est.geo === 'UK' ? 'bg-blue-50 text-blue-700' :
                            est.geo === 'US' ? 'bg-green-50 text-green-700' :
                            'bg-yellow-50 text-yellow-700'
                          }`}>{est.geo}</span>
                        </TableCell>
                        <TableCell className="py-2.5 font-semibold text-sm tabular-nums">
                          {fmt(CURRENCY[est.geo].symbol, est.total)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-blue-600 hover:bg-blue-50"
                              onClick={() => handleLoad(est)}>
                              <Upload className="w-3 h-3" /> Load
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(est.id)}>
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
