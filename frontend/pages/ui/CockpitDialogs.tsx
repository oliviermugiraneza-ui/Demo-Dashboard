import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../lib/shadcn/dialog'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Textarea } from '../../lib/shadcn/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../lib/shadcn/select'
import type { DemoRequest, DemoType } from '../data/sampleData'

export const CANCEL_REASONS = [
  'Client request', 'Vehicle unavailable', 'Driver unavailable',
  'Route issue', 'Weather', 'Internal ops conflict', 'Safety concern', 'Other',
]

const DEMO_TYPES: DemoType[] = [
  'VIP', 'Media', 'External', 'OEM Support', 'Performance Check', 'Friend & Family', 'Conference', 'Candidate',
]

// ─── Cancel Dialog ────────────────────────────────────────────────────────────

interface CancelDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function CancelDialog({ open, onClose, onConfirm }: CancelDialogProps) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (!open) setReason('') }, [open])

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel Demo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">Select a cancellation reason to continue.</p>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason…" />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Back</Button>
          <Button size="sm" variant="destructive" disabled={!reason}
            onClick={() => { onConfirm(reason); onClose() }}>
            Confirm Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reschedule Dialog ────────────────────────────────────────────────────────

interface RescheduleDialogProps {
  open: boolean
  demo: DemoRequest | null
  onClose: () => void
  onConfirm: (date: string, start: string, end: string) => void
}

export function RescheduleDialog({ open, demo, onClose, onConfirm }: RescheduleDialogProps) {
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  useEffect(() => {
    if (demo) { setDate(demo.demo_date); setStart(demo.start_time); setEnd(demo.end_time) }
  }, [demo])

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule — {demo?.organization}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold">New Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">Start Time</Label>
              <Input type="time" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-semibold">End Time</Label>
              <Input type="time" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!date || !start || !end}
            onClick={() => { onConfirm(date, start, end); onClose() }}>
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
  open: boolean
  demo: DemoRequest | null
  onClose: () => void
  onConfirm: (updated: Partial<DemoRequest>) => void
}

export function EditDialog({ open, demo, onClose, onConfirm }: EditDialogProps) {
  const [org, setOrg]               = useState('')
  const [requester, setRequester]   = useState('')
  const [host, setHost]             = useState('')
  const [type, setType]             = useState<string>('VIP')
  const [guests, setGuests]         = useState('1')
  const [vehicles, setVehicles]     = useState('1')
  const [vehicleType, setVehicleType] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (demo) {
      setOrg(demo.organization); setRequester(demo.requester); setHost(demo.host)
      setType(demo.type); setGuests(String(demo.total_guests))
      setVehicles(String(demo.total_vehicles)); setVehicleType(demo.vehicle_type)
      setDescription(demo.description)
    }
  }, [demo])

  const handleSave = () => {
    onConfirm({
      organization: org, requester, host, type,
      total_guests: parseInt(guests) || 0,
      total_vehicles: parseInt(vehicles) || 0,
      vehicle_type: vehicleType, description,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Demo — {demo?.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold">Organisation</Label>
              <Input value={org} onChange={e => setOrg(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold">Demo Type</Label>
              <Select value={type} onValueChange={v => setType(v as DemoType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEMO_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold">Requester</Label>
              <Input value={requester} onChange={e => setRequester(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold">Host</Label>
              <Input value={host} onChange={e => setHost(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block text-xs font-semibold">Guests</Label>
              <Input type="number" min="1" value={guests} onChange={e => setGuests(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold">Vehicles</Label>
              <Input type="number" min="1" value={vehicles} onChange={e => setVehicles(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold">Vehicle Type</Label>
              <Input value={vehicleType} onChange={e => setVehicleType(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-semibold">Description</Label>
            <Textarea
              className="min-h-[80px] resize-none text-sm"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
