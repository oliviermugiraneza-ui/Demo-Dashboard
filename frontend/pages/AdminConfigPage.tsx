import {
  useState, useEffect, useCallback, type ReactNode,
} from 'react'
import { toast } from 'sonner'
import {
  Search, RefreshCw, Plus, Edit2, Trash2, X, Check, Eye, EyeOff,
  ExternalLink, ChevronDown,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const GEOS = ['JP', 'UK', 'US', 'DE'] as const

const AVATAR_COLORS = ['#4F46E5','#2563EB','#0891B2','#059669','#D97706','#DC2626','#7C3AED']

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const ini  = name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  const code = (name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0)
  const bg   = AVATAR_COLORS[code % AVATAR_COLORS.length]!
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
         style={{ backgroundColor: bg }}>
      {ini || '?'}
    </div>
  )
}

const BADGE_STYLES: Record<string, { text: string; bg: string }> = {
  JP: { text: '#991b1b', bg: '#fef2f2' }, UK: { text: '#1e40af', bg: '#eff6ff' },
  US: { text: '#065f46', bg: '#ecfdf5' }, DE: { text: '#92400e', bg: '#fffbeb' },
  Admin:       { text: '#1d4ed8', bg: '#dbeafe' },
  'Super Admin':{ text: '#6d28d9', bg: '#ede9fe' },
  Host:        { text: '#c2410c', bg: '#fff7ed' },
  Operator:    { text: '#065f46', bg: '#ecfdf5' },
  Assistant:   { text: '#374151', bg: '#f3f4f6' },
  dGPU: { text: '#1d4ed8', bg: '#dbeafe' },
  iGPU: { text: '#065f46', bg: '#ecfdf5' },
  QC:   { text: '#7c2d12', bg: '#fff7ed' },
  Nvidia: { text: '#1d4ed8', bg: '#dbeafe' },
}

function Badge({ label }: { label: string }) {
  const s = BADGE_STYLES[label] ?? { text: '#374151', bg: '#f3f4f6' }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-px rounded"
          style={{ color: s.text, backgroundColor: s.bg }}>
      {label}
    </span>
  )
}

function BaselineDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
    </span>
  )
}

// ─── Shared layout atoms ─────────────────────────────────────────────────────

function Toolbar({
  search, onSearch, placeholder, geoFilter, onGeoFilter,
  onRefresh, refreshing, onAdd, addLabel = '+ Add',
}: {
  search: string; onSearch: (v: string) => void; placeholder?: string
  geoFilter: string; onGeoFilter: (v: string) => void
  onRefresh: () => void; refreshing?: boolean
  onAdd: () => void; addLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-white">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder ?? 'Search…'}
          className="w-full pl-7 pr-3 h-7 text-xs rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white" />
        {search && (
          <button onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="relative">
        <select value={geoFilter} onChange={e => onGeoFilter(e.target.value)}
          className="h-7 pl-2 pr-6 text-xs rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white appearance-none cursor-pointer text-gray-600">
          <option value="ALL">All GEOs</option>
          {GEOS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-400 pointer-events-none" />
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <button onClick={onRefresh} disabled={refreshing}
          className="h-7 px-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button onClick={onAdd}
          className="h-7 px-2.5 flex items-center gap-1 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-md transition-colors">
          <Plus className="w-3 h-3" />
          {addLabel}
        </button>
      </div>
    </div>
  )
}

function EmptyState({ icon, message, sub }: { icon?: ReactNode; message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {icon && <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center mb-3 text-gray-300">{icon}</div>}
      <p className="text-sm font-medium text-gray-400">{message}</p>
      {sub && <p className="text-xs text-gray-300 mt-0.5">{sub}</p>}
    </div>
  )
}

function LoadingRows({ cols = 5 }: { cols?: number }) {
  return (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={`h-2.5 bg-gray-100 rounded ${j === 0 ? 'w-28' : j === 1 ? 'flex-1' : 'w-12'}`} />
          ))}
        </div>
      ))}
    </>
  )
}

// ─── Table header row ─────────────────────────────────────────────────────────

function TH({ cols, headers }: { cols: string; headers: string[] }) {
  return (
    <div className={`grid ${cols} gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50/80 sticky top-0`}>
      {headers.map((h, i) => (
        <div key={i} className="text-[11px] font-semibold text-gray-400/80 uppercase tracking-widest">{h}</div>
      ))}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title, onClose, onSave, saving, children,
}: {
  title: string; onClose: () => void; onSave: () => void; saving?: boolean; children: ReactNode
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="h-7 px-3 text-xs font-medium text-gray-500 hover:text-gray-800 rounded-md border border-gray-200 hover:bg-white transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            className="h-7 px-3 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1d4ed8] rounded-md transition-colors disabled:opacity-60 flex items-center gap-1.5">
            {saving
              ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Check className="w-3 h-3" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmDelete({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-5">
          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Delete {name}?</h3>
          <p className="text-xs text-gray-400">This action cannot be undone.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onCancel} className="h-7 px-3 text-xs font-medium text-gray-500 rounded-md border border-gray-200 hover:bg-white transition-colors">Cancel</button>
          <button onClick={onConfirm} className="h-7 px-3 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </p>
      {children}
    </div>
  )
}

const inputCls = "w-full h-8 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"

function FieldInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className={inputCls} />
  )
}

function FieldSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`${inputCls} appearance-none pr-8 cursor-pointer`}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ─── Generic CRUD hook ────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: number }

function useCrud(endpoint: string) {
  const [rows, setRows]       = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async (geo?: string) => {
    setLoading(true)
    try {
      const qs  = geo && geo !== 'ALL' ? `?geo=${geo}` : ''
      const res = await fetch(`${endpoint}${qs}`)
      const j   = await res.json() as { ok: boolean; data: Row[] }
      setRows(j.ok ? j.data.map(r => ({ ...r, id: Number(r.id) })) : [])
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [endpoint])

  const create_ = async (body: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j   = await res.json() as { ok: boolean; error?: string }
    if (!j.ok) throw new Error(j.error ?? 'Create failed')
    return true
  }

  const update_ = async (id: number, body: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch(`${endpoint}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j   = await res.json() as { ok: boolean; error?: string }
    if (!j.ok) throw new Error(j.error ?? 'Update failed')
    return true
  }

  const delete_ = async (id: number): Promise<boolean> => {
    const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE' })
    const j   = await res.json() as { ok: boolean; error?: string }
    if (!j.ok) throw new Error(j.error ?? 'Delete failed')
    return true
  }

  return { rows, loading, fetch: fetch_, create: create_, update: update_, delete: delete_ }
}

// ─── Row action buttons ───────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
        <Edit2 className="w-3 h-3" />
      </button>
      <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── TAB 1: Admin Users ───────────────────────────────────────────────────────

const ADMIN_ROLES = ['Admin', 'Super Admin']

function AdminTab() {
  const crud = useCrud('/api/admin/users')
  const [geo, setGeo]   = useState('ALL')
  const [q, setQ]       = useState('')
  const [modal, setModal]   = useState<{ mode: 'add' | 'edit'; row?: Row } | null>(null)
  const [del, setDel]       = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', geo: 'UK', role: 'Admin' })

  useEffect(() => { void crud.fetch(geo) }, [geo])

  const openAdd  = () => { setForm({ full_name:'', email:'', password:'', geo:'UK', role:'Admin' }); setShowPwd(false); setModal({ mode:'add' }) }
  const openEdit = (r: Row) => {
    setForm({ full_name: String(r.full_name??''), email: String(r.email??''), password: String(r.password??''), geo: String(r.geo??'UK'), role: String(r.role??'Admin') })
    setShowPwd(false); setModal({ mode:'edit', row:r })
  }

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim()) { toast.error('Name and email are required'); return }
    setSaving(true)
    try {
      if (modal?.mode === 'add') { await crud.create(form); toast.success('Admin user added') }
      else { await crud.update(modal!.row!.id, form); toast.success('Admin user updated') }
      setModal(null); void crud.fetch(geo)
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  const confirmDel = async () => {
    if (!del) return
    try { await crud.delete(del.id); toast.success(`${String(del.full_name)} removed`); setDel(null); void crud.fetch(geo) }
    catch (e) { toast.error(String(e)) }
  }

  const filtered = crud.rows.filter(r =>
    !q || String(r.full_name??'').toLowerCase().includes(q.toLowerCase()) || String(r.email??'').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <Toolbar search={q} onSearch={setQ} placeholder="Search admin…" geoFilter={geo} onGeoFilter={setGeo}
        onRefresh={() => void crud.fetch(geo)} refreshing={crud.loading} onAdd={openAdd} addLabel="+ Add Admin" />

      <div className="flex-1 overflow-auto">
        <TH cols="grid-cols-[1.75rem_1fr_1.5fr_1fr_60px_80px_56px]"
            headers={['', 'Full Name', 'Email', 'Password', 'GEO', 'Role', '']} />

        {crud.loading ? <LoadingRows cols={6} /> : filtered.length === 0 ? (
          <EmptyState icon={<Search className="w-4 h-4" />} message="No admin users found" sub="Create your first admin user." />
        ) : filtered.map(row => (
          <AdminUserRow key={row.id} row={row} onEdit={() => openEdit(row)} onDelete={() => setDel(row)} />
        ))}
      </div>

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Add Admin User' : 'Edit Admin User'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Field label="Full Name" required><FieldInput value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name:v }))} placeholder="Jane Smith" /></Field>
          <Field label="Email" required><FieldInput value={form.email} onChange={v => setForm(f => ({ ...f, email:v }))} type="email" placeholder="name@wayve.ai" /></Field>
          <Field label="Password">
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="optional" className={`${inputCls} pr-9 font-mono`} />
              <button type="button" onClick={() => setShowPwd(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GEO" required><FieldSelect value={form.geo} onChange={v => setForm(f => ({ ...f, geo:v }))} options={[...GEOS]} /></Field>
            <Field label="Role" required><FieldSelect value={form.role} onChange={v => setForm(f => ({ ...f, role:v }))} options={ADMIN_ROLES} /></Field>
          </div>
        </Modal>
      )}
      {del && <ConfirmDelete name={String(del.full_name)} onConfirm={confirmDel} onCancel={() => setDel(null)} />}
    </div>
  )
}

function AdminUserRow({ row, onEdit, onDelete }: { row: Row; onEdit: () => void; onDelete: () => void }) {
  const [show, setShow] = useState(false)
  const pwd = String(row.password ?? '')
  return (
    <div className="group grid grid-cols-[1.75rem_1fr_1.5fr_1fr_60px_80px_56px] gap-3 items-center px-6 py-3.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
      <Avatar name={String(row.full_name ?? '')} />
      <span className="text-sm font-medium text-gray-800 truncate">{String(row.full_name ?? '')}</span>
      <span className="text-sm text-gray-400 truncate">{String(row.email ?? '')}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-mono text-gray-400 truncate">{pwd ? (show ? pwd : '••••••••') : <span className="text-gray-200">—</span>}</span>
        {pwd && <button onClick={() => setShow(s => !s)} className="flex-shrink-0 text-gray-200 hover:text-gray-400">{show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>}
      </div>
      <Badge label={String(row.geo ?? '')} />
      <Badge label={String(row.role ?? '')} />
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

// ─── Shared People tab (Hosts + Operators) ────────────────────────────────────

function PeopleTab({ endpoint, entityLabel, roles, defaultRole, searchPlaceholder, addLabel }: {
  endpoint: string; entityLabel: string; roles: string[]; defaultRole: string
  searchPlaceholder: string; addLabel: string
}) {
  const crud = useCrud(endpoint)
  const [geo, setGeo]       = useState('ALL')
  const [q, setQ]           = useState('')
  const [modal, setModal]   = useState<{ mode: 'add'|'edit'; row?: Row } | null>(null)
  const [del, setDel]       = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ full_name: '', email: '', geo: 'UK', role: defaultRole })

  useEffect(() => { void crud.fetch(geo) }, [geo])

  const openAdd  = () => { setForm({ full_name:'', email:'', geo:'UK', role:defaultRole }); setModal({ mode:'add' }) }
  const openEdit = (r: Row) => { setForm({ full_name:String(r.full_name??''), email:String(r.email??''), geo:String(r.geo??'UK'), role:String(r.role??defaultRole) }); setModal({ mode:'edit', row:r }) }

  const save = async () => {
    if (!form.full_name.trim() || !form.email.trim()) { toast.error('Name and email are required'); return }
    setSaving(true)
    try {
      if (modal?.mode === 'add') { await crud.create(form); toast.success(`${entityLabel} added`) }
      else { await crud.update(modal!.row!.id, form); toast.success(`${entityLabel} updated`) }
      setModal(null); void crud.fetch(geo)
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  const confirmDel = async () => {
    if (!del) return
    try { await crud.delete(del.id); toast.success(`${String(del.full_name)} removed`); setDel(null); void crud.fetch(geo) }
    catch (e) { toast.error(String(e)) }
  }

  const filtered = crud.rows.filter(r =>
    !q || String(r.full_name??'').toLowerCase().includes(q.toLowerCase()) || String(r.email??'').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      <Toolbar search={q} onSearch={setQ} placeholder={searchPlaceholder} geoFilter={geo} onGeoFilter={setGeo}
        onRefresh={() => void crud.fetch(geo)} refreshing={crud.loading} onAdd={openAdd} addLabel={addLabel} />
      <div className="flex-1 overflow-auto">
        <TH cols="grid-cols-[1.75rem_1fr_1.5fr_60px_80px_56px]"
            headers={['', 'Full Name', 'Email', 'GEO', 'Role', '']} />

        {crud.loading ? <LoadingRows cols={5} /> : filtered.length === 0 ? (
          <EmptyState icon={<Search className="w-4 h-4" />} message={`No ${entityLabel.toLowerCase()}s found`} sub={`Create your first ${entityLabel.toLowerCase()}.`} />
        ) : filtered.map(row => (
          <div key={row.id} className="group grid grid-cols-[1.75rem_1fr_1.5fr_60px_80px_56px] gap-3 items-center px-6 py-3.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            <Avatar name={String(row.full_name??'')} />
            <span className="text-sm font-medium text-gray-800 truncate">{String(row.full_name??'')}</span>
            <span className="text-sm text-gray-400 truncate">{String(row.email??'')}</span>
            <Badge label={String(row.geo??'')} />
            <Badge label={String(row.role??'')} />
            <RowActions onEdit={() => openEdit(row)} onDelete={() => setDel(row)} />
          </div>
        ))}
      </div>
      {modal && (
        <Modal title={`${modal.mode === 'add' ? 'Add' : 'Edit'} ${entityLabel}`} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Field label="Full Name" required><FieldInput value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name:v }))} placeholder="Full Name" /></Field>
          <Field label="Email" required><FieldInput value={form.email} onChange={v => setForm(f => ({ ...f, email:v }))} type="email" placeholder="name@wayve.ai" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GEO" required><FieldSelect value={form.geo} onChange={v => setForm(f => ({ ...f, geo:v }))} options={[...GEOS]} /></Field>
            <Field label="Role" required><FieldSelect value={form.role} onChange={v => setForm(f => ({ ...f, role:v }))} options={roles} /></Field>
          </div>
        </Modal>
      )}
      {del && <ConfirmDelete name={String(del.full_name)} onConfirm={confirmDel} onCancel={() => setDel(null)} />}
    </div>
  )
}

function HostsTab() {
  return <PeopleTab endpoint="/api/admin/hosts" entityLabel="Host" roles={['Host']} defaultRole="Host"
    searchPlaceholder="Search host…" addLabel="+ Add Host" />
}

function OperatorsTab() {
  return <PeopleTab endpoint="/api/admin/operators" entityLabel="Operator" roles={['Operator','Assistant']} defaultRole="Operator"
    searchPlaceholder="Search operator…" addLabel="+ Add Operator" />
}

// ─── TAB 4: Models ────────────────────────────────────────────────────────────

const PLATFORMS = ['dGPU', 'iGPU', 'QC']

function ModelsTab() {
  const crud = useCrud('/api/admin/models')
  const [geo, setGeo]       = useState('ALL')
  const [q, setQ]           = useState('')
  const [modal, setModal]   = useState<{ mode: 'add'|'edit'; row?: Row } | null>(null)
  const [del, setDel]       = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ model_name: '', platform: 'dGPU', baseline_tag: 'No', geo: 'UK' })

  useEffect(() => { void crud.fetch(geo) }, [geo])

  const isBaseline = (row: Row) => row.baseline_tag === true || row.baseline_tag === 't' || row.baseline_tag === 'true' || row.baseline_tag === 'Yes'

  const openAdd  = () => { setForm({ model_name:'', platform:'dGPU', baseline_tag:'No', geo:'UK' }); setModal({ mode:'add' }) }
  const openEdit = (r: Row) => {
    setForm({
      model_name: String(r.model_name??''),
      platform:   String(r.platform??'dGPU'),
      baseline_tag: isBaseline(r) ? 'Yes' : 'No',
      geo: String(r.geo??'UK'),
    })
    setModal({ mode:'edit', row:r })
  }

  const save = async () => {
    if (!form.model_name.trim()) { toast.error('Model name is required'); return }
    setSaving(true)
    try {
      const body = { ...form, baseline_tag: form.baseline_tag === 'Yes' }
      if (modal?.mode === 'add') { await crud.create(body); toast.success('Model added') }
      else { await crud.update(modal!.row!.id, body); toast.success('Model updated') }
      setModal(null); void crud.fetch(geo)
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  const confirmDel = async () => {
    if (!del) return
    try { await crud.delete(del.id); toast.success('Model removed'); setDel(null); void crud.fetch(geo) }
    catch (e) { toast.error(String(e)) }
  }

  const filtered = crud.rows.filter(r => !q || String(r.model_name??'').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="flex flex-col h-full">
      <Toolbar search={q} onSearch={setQ} placeholder="Search model…" geoFilter={geo} onGeoFilter={setGeo}
        onRefresh={() => void crud.fetch(geo)} refreshing={crud.loading} onAdd={openAdd} addLabel="+ Add Model" />
      <div className="flex-1 overflow-auto">
        <TH cols="grid-cols-[1fr_80px_44px_60px_56px]"
            headers={['Model Name', 'Platform', 'Base', 'GEO', '']} />

        {crud.loading ? <LoadingRows cols={4} /> : filtered.length === 0 ? (
          <EmptyState message="No models created yet" sub="Create your first model." />
        ) : filtered.map(row => (
          <div key={row.id} className="group grid grid-cols-[1fr_80px_44px_60px_56px] gap-3 items-center px-6 py-3.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            <span className="text-sm font-mono font-medium text-gray-800 truncate">{String(row.model_name??'')}</span>
            <Badge label={String(row.platform??'')} />
            <div className="flex items-center">
              {isBaseline(row) ? <BaselineDot /> : null}
            </div>
            <Badge label={String(row.geo??'')} />
            <RowActions onEdit={() => openEdit(row)} onDelete={() => setDel(row)} />
          </div>
        ))}
      </div>
      {modal && (
        <Modal title={`${modal.mode === 'add' ? 'Add' : 'Edit'} Model`} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Field label="Model Name" required><FieldInput value={form.model_name} onChange={v => setForm(f => ({ ...f, model_name:v }))} placeholder="e.g. jade-dancing-firefly" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform"><FieldSelect value={form.platform} onChange={v => setForm(f => ({ ...f, platform:v }))} options={PLATFORMS} /></Field>
            <Field label="GEO" required><FieldSelect value={form.geo} onChange={v => setForm(f => ({ ...f, geo:v }))} options={[...GEOS]} /></Field>
          </div>
          <Field label="Baseline">
            <div className="flex items-center gap-3 pt-0.5">
              {(['Yes', 'No'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="radio" name="baseline_tag" value={opt} checked={form.baseline_tag === opt}
                    onChange={() => setForm(f => ({ ...f, baseline_tag: opt }))}
                    className="w-3.5 h-3.5 accent-blue-600" />
                  <span className="text-sm text-gray-700 flex items-center gap-1.5">
                    {opt}
                    {opt === 'Yes' && <BaselineDot />}
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </Modal>
      )}
      {del && <ConfirmDelete name={String(del.model_name)} onConfirm={confirmDel} onCancel={() => setDel(null)} />}
    </div>
  )
}

// ─── TAB 5: Routes ────────────────────────────────────────────────────────────

function RoutesTab() {
  const crud = useCrud('/api/admin/routes')
  const [geo, setGeo]       = useState('ALL')
  const [q, setQ]           = useState('')
  const [modal, setModal]   = useState<{ mode: 'add'|'edit'; row?: Row } | null>(null)
  const [del, setDel]       = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ route_name: '', console_link: '', geo: 'UK' })

  useEffect(() => { void crud.fetch(geo) }, [geo])

  const openAdd  = () => { setForm({ route_name:'', console_link:'', geo:'UK' }); setModal({ mode:'add' }) }
  const openEdit = (r: Row) => { setForm({ route_name:String(r.route_name??''), console_link:String(r.console_link??''), geo:String(r.geo??'UK') }); setModal({ mode:'edit', row:r }) }

  const save = async () => {
    if (!form.route_name.trim()) { toast.error('Route name is required'); return }
    setSaving(true)
    try {
      if (modal?.mode === 'add') { await crud.create(form); toast.success('Route added') }
      else { await crud.update(modal!.row!.id, form); toast.success('Route updated') }
      setModal(null); void crud.fetch(geo)
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  const confirmDel = async () => {
    if (!del) return
    try { await crud.delete(del.id); toast.success('Route removed'); setDel(null); void crud.fetch(geo) }
    catch (e) { toast.error(String(e)) }
  }

  const filtered = crud.rows.filter(r => !q || String(r.route_name??'').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="flex flex-col h-full">
      <Toolbar search={q} onSearch={setQ} placeholder="Search route…" geoFilter={geo} onGeoFilter={setGeo}
        onRefresh={() => void crud.fetch(geo)} refreshing={crud.loading} onAdd={openAdd} addLabel="+ Add Route" />
      <div className="flex-1 overflow-auto">
        <TH cols="grid-cols-[1fr_120px_60px_56px]"
            headers={['Route Name', 'Console', 'GEO', '']} />

        {crud.loading ? <LoadingRows cols={3} /> : filtered.length === 0 ? (
          <EmptyState message="No routes created yet" sub="Create your first route." />
        ) : filtered.map(row => (
          <div key={row.id} className="group grid grid-cols-[1fr_120px_60px_56px] gap-3 items-center px-6 py-3.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            <span className="text-sm font-medium text-gray-800 truncate">{String(row.route_name??'')}</span>
            {row.console_link ? (
              <a href={String(row.console_link)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700 hover:underline truncate">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Link</span>
              </a>
            ) : <span className="text-xs text-gray-200">—</span>}
            <Badge label={String(row.geo??'')} />
            <RowActions onEdit={() => openEdit(row)} onDelete={() => setDel(row)} />
          </div>
        ))}
      </div>
      {modal && (
        <Modal title={`${modal.mode === 'add' ? 'Add' : 'Edit'} Route`} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Field label="Route Name" required><FieldInput value={form.route_name} onChange={v => setForm(f => ({ ...f, route_name:v }))} placeholder="e.g. JP-DEMO-Otemachi_30min" /></Field>
          <Field label="Console Link"><FieldInput value={form.console_link} onChange={v => setForm(f => ({ ...f, console_link:v }))} placeholder="https://console.wayve.ai/routes/…" /></Field>
          <Field label="GEO" required><FieldSelect value={form.geo} onChange={v => setForm(f => ({ ...f, geo:v }))} options={[...GEOS]} /></Field>
        </Modal>
      )}
      {del && <ConfirmDelete name={String(del.route_name)} onConfirm={confirmDel} onCancel={() => setDel(null)} />}
    </div>
  )
}

// ─── TAB 6: Vehicles ─────────────────────────────────────────────────────────

const VEHICLE_TYPES = ['Nvidia', 'QC']

function VehiclesTab() {
  const crud = useCrud('/api/admin/vehicles')
  const [geo, setGeo]       = useState('ALL')
  const [q, setQ]           = useState('')
  const [modal, setModal]   = useState<{ mode: 'add'|'edit'; row?: Row } | null>(null)
  const [del, setDel]       = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm]     = useState({ vehicle_id: '', vehicle_type: 'Nvidia', geo: 'UK' })

  useEffect(() => { void crud.fetch(geo) }, [geo])

  const openAdd  = () => { setForm({ vehicle_id:'', vehicle_type:'Nvidia', geo:'UK' }); setModal({ mode:'add' }) }
  const openEdit = (r: Row) => { setForm({ vehicle_id:String(r.vehicle_id??''), vehicle_type:String(r.vehicle_type??'Nvidia'), geo:String(r.geo??'UK') }); setModal({ mode:'edit', row:r }) }

  const save = async () => {
    if (!form.vehicle_id.trim()) { toast.error('Vehicle ID is required'); return }
    setSaving(true)
    try {
      if (modal?.mode === 'add') { await crud.create(form); toast.success('Vehicle added') }
      else { await crud.update(modal!.row!.id, form); toast.success('Vehicle updated') }
      setModal(null); void crud.fetch(geo)
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  const confirmDel = async () => {
    if (!del) return
    try { await crud.delete(del.id); toast.success('Vehicle removed'); setDel(null); void crud.fetch(geo) }
    catch (e) { toast.error(String(e)) }
  }

  const filtered = crud.rows.filter(r => !q || String(r.vehicle_id??'').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="flex flex-col h-full">
      <Toolbar search={q} onSearch={setQ} placeholder="Search vehicle…" geoFilter={geo} onGeoFilter={setGeo}
        onRefresh={() => void crud.fetch(geo)} refreshing={crud.loading} onAdd={openAdd} addLabel="+ Add Vehicle" />
      <div className="flex-1 overflow-auto">
        <TH cols="grid-cols-[1fr_80px_60px_56px]"
            headers={['Vehicle ID', 'Type', 'GEO', '']} />

        {crud.loading ? <LoadingRows cols={3} /> : filtered.length === 0 ? (
          <EmptyState message="No vehicles created yet" sub="Create your first vehicle." />
        ) : filtered.map(row => (
          <div key={row.id} className="group grid grid-cols-[1fr_80px_60px_56px] gap-3 items-center px-6 py-3.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
            <span className="text-sm font-mono font-medium text-gray-800">{String(row.vehicle_id??'')}</span>
            <Badge label={String(row.vehicle_type??'')} />
            <Badge label={String(row.geo??'')} />
            <RowActions onEdit={() => openEdit(row)} onDelete={() => setDel(row)} />
          </div>
        ))}
      </div>
      {modal && (
        <Modal title={`${modal.mode === 'add' ? 'Add' : 'Edit'} Vehicle`} onClose={() => setModal(null)} onSave={save} saving={saving}>
          <Field label="Vehicle ID" required><FieldInput value={form.vehicle_id} onChange={v => setForm(f => ({ ...f, vehicle_id:v }))} placeholder="e.g. KU-W01" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><FieldSelect value={form.vehicle_type} onChange={v => setForm(f => ({ ...f, vehicle_type:v }))} options={VEHICLE_TYPES} /></Field>
            <Field label="GEO" required><FieldSelect value={form.geo} onChange={v => setForm(f => ({ ...f, geo:v }))} options={[...GEOS]} /></Field>
          </div>
        </Modal>
      )}
      {del && <ConfirmDelete name={String(del.vehicle_id)} onConfirm={confirmDel} onCancel={() => setDel(null)} />}
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'admin',    label: 'Admin' },
  { id: 'hosts',    label: 'Hosts' },
  { id: 'operators',label: 'Operators' },
  { id: 'models',   label: 'Models' },
  { id: 'routes',   label: 'Routes' },
  { id: 'vehicles', label: 'Vehicles' },
] as const

type TabId = typeof TABS[number]['id']

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminConfigPage() {
  const [tab, setTab] = useState<TabId>('admin')

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC] overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5">
        <div className="flex items-end">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap
                ${tab === t.id ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-600'}`}>
              {t.label}
              {tab === t.id && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#2563EB] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white m-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
        {tab === 'admin'     && <AdminTab />}
        {tab === 'hosts'     && <HostsTab />}
        {tab === 'operators' && <OperatorsTab />}
        {tab === 'models'    && <ModelsTab />}
        {tab === 'routes'    && <RoutesTab />}
        {tab === 'vehicles'  && <VehiclesTab />}
      </div>
    </div>
  )
}
