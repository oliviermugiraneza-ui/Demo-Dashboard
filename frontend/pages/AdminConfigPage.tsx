import { useState, useEffect } from 'react'
import { Edit2, Trash2, Plus, Save, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../lib/shadcn/select'
import {
  useGetAdminUsers, useCreateAdminUser, useUpdateAdminUser, useDeleteAdminUser,
} from '../hooks/backend/adminUsers'

// ─── Types ────────────────────────────────────────────────────────────────────

type GeoRole = 'Admin' | 'Assistant' | 'Super Admin'

interface AdminRow {
  id: number
  full_name: string
  email: string
  password: string
  geo: string
  role: GeoRole
}

const ROLE_OPTIONS: GeoRole[] = ['Admin', 'Assistant', 'Super Admin']
const GEO_OPTIONS = ['UK', 'US', 'JP', 'DE', 'ST']

// ─── Styling maps ─────────────────────────────────────────────────────────────

const GEO_STYLE: Record<string, { tagText: string; tagBg: string }> = {
  UK: { tagText: '#1e40af', tagBg: '#dbeafe' },
  US: { tagText: '#065f46', tagBg: '#d1fae5' },
  JP: { tagText: '#991b1b', tagBg: '#fee2e2' },
  DE: { tagText: '#92400e', tagBg: '#fef3c7' },
  ST: { tagText: '#5b21b6', tagBg: '#ede9fe' },
}

const ROLE_STYLE: Record<string, { text: string; bg: string }> = {
  'Admin':       { text: '#1d4ed8', bg: '#dbeafe' },
  'Assistant':   { text: '#374151', bg: '#f3f4f6' },
  'Super Admin': { text: '#6d28d9', bg: '#ede9fe' },
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5']

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
  const code = (name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0)
  const color = AVATAR_PALETTE[code % AVATAR_PALETTE.length] ?? '#2563EB'
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
         style={{ backgroundColor: color }}>
      {initials || '?'}
    </div>
  )
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_FORM = { full_name: '', email: '', password: '', geo: '', role: 'Admin' as GeoRole }

// ─── Main Page ────────────────────────────────────────────────────────────────

const COL_HEADERS = ['FULL NAME', 'EMAIL', 'PASSWORD', 'GEO', 'ROLE', '']
const GRID = 'grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.2fr)_130px_80px_130px_80px]'

export default function AdminConfigPage() {
  const { data: rawData, loading, trigger: fetchUsers } = useGetAdminUsers()
  const { trigger: createUser, loading: creating }      = useCreateAdminUser()
  const { trigger: updateUser, loading: updating }      = useUpdateAdminUser()
  const { trigger: deleteUser }                         = useDeleteAdminUser()

  const users = (rawData ?? []) as AdminRow[]

  const [editId, setEditId]     = useState<number | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [newForm, setNewForm]   = useState(EMPTY_FORM)
  const [showPwd, setShowPwd]   = useState<Record<number, boolean>>({})

  useEffect(() => { void fetchUsers() }, [])

  function startEdit(row: AdminRow) {
    setEditId(row.id)
    setEditForm({ full_name: row.full_name, email: row.email, password: row.password, geo: row.geo, role: row.role })
  }

  async function saveEdit() {
    if (!editId) return
    try {
      await updateUser({ id: editId, ...editForm })
      toast.success('User updated')
      setEditId(null)
      void fetchUsers()
    } catch { toast.error('Update failed') }
  }

  async function handleDelete(id: number, name: string) {
    try {
      await deleteUser({ id })
      toast.success(`${name} removed`)
      void fetchUsers()
    } catch { toast.error('Delete failed') }
  }

  async function handleAdd() {
    if (!newForm.full_name.trim() || !newForm.email.trim() || !newForm.geo) {
      toast.error('Full name, email and GEO are required'); return
    }
    try {
      await createUser(newForm)
      toast.success('User added')
      setNewForm(EMPTY_FORM)
      void fetchUsers()
    } catch { toast.error('Failed to add user — email may already exist') }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <div className="p-6 space-y-5 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Admin Users</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage GEO leads, roles and access credentials</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-400 hover:text-gray-700"
            onClick={() => void fetchUsers()}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

          {/* Column headers */}
          <div className={`grid ${GRID} px-5 py-2.5 bg-gray-50 border-b border-gray-100`}>
            {COL_HEADERS.map((h, i) => (
              <div key={i} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="flex items-center justify-center py-14 text-gray-400 text-sm gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                Loading…
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-14 text-gray-400 text-sm">No admin users yet — add one below.</div>
            ) : users.map(row => {
              const isEditing   = editId === row.id
              const geoStyle    = GEO_STYLE[isEditing ? editForm.geo : row.geo]
              const roleStyle   = ROLE_STYLE[isEditing ? editForm.role : row.role]
              const pwdVisible  = showPwd[row.id] ?? false
              const displayName = isEditing ? (editForm.full_name || row.full_name) : row.full_name

              return (
                <div key={row.id}
                  className={`grid ${GRID} items-center px-5 py-3 hover:bg-gray-50 transition-colors`}>

                  {/* Full Name */}
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <Avatar name={displayName} />
                    {isEditing
                      ? <Input className="h-7 text-sm" value={editForm.full_name}
                          onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                      : <span className="text-sm font-semibold text-gray-900 truncate">{row.full_name}</span>}
                  </div>

                  {/* Email */}
                  <div className="min-w-0 pr-3">
                    {isEditing
                      ? <Input className="h-7 text-sm" type="email" value={editForm.email}
                          onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                      : <span className="text-sm text-gray-500 truncate block">{row.email}</span>}
                  </div>

                  {/* Password */}
                  <div className="pr-3">
                    {isEditing
                      ? <Input className="h-7 text-sm font-mono" placeholder="Password" value={editForm.password}
                          onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
                      : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-mono text-gray-500">
                            {row.password
                              ? (pwdVisible ? row.password : '••••••••')
                              : <span className="text-gray-300 not-italic">—</span>}
                          </span>
                          {row.password && (
                            <button className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                              onClick={() => setShowPwd(p => ({ ...p, [row.id]: !p[row.id] }))}>
                              {pwdVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      )}
                  </div>

                  {/* GEO */}
                  <div>
                    {isEditing
                      ? (
                        <Select value={editForm.geo || '_'} onValueChange={v => setEditForm(f => ({ ...f, geo: v === '_' ? '' : v }))}>
                          <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>{GEO_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                              style={{ color: geoStyle?.tagText ?? '#374151', backgroundColor: geoStyle?.tagBg ?? '#f3f4f6' }}>
                          {row.geo}
                        </span>
                      )}
                  </div>

                  {/* Role */}
                  <div>
                    {isEditing
                      ? (
                        <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v as GeoRole }))}>
                          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{ color: roleStyle?.text ?? '#374151', backgroundColor: roleStyle?.bg ?? '#f3f4f6' }}>
                          {row.role}
                        </span>
                      )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 justify-end">
                    {isEditing ? (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                          disabled={updating} onClick={saveEdit} aria-label="Save">
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                          onClick={() => setEditId(null)} aria-label="Cancel">
                          <span className="text-lg leading-none">×</span>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-blue-600"
                          onClick={() => startEdit(row)} aria-label="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-300 hover:text-red-500"
                          onClick={() => handleDelete(row.id, row.full_name)} aria-label="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add form */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600 mb-3">Add Admin User</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Input className="h-9 text-sm flex-1 min-w-[130px]" placeholder="Full name"
                value={newForm.full_name} onChange={e => setNewForm(f => ({ ...f, full_name: e.target.value }))} />
              <Input className="h-9 text-sm flex-1 min-w-[160px]" placeholder="Email address" type="email"
                value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
              <Input className="h-9 text-sm w-32 font-mono" placeholder="Password"
                value={newForm.password} onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))} />
              <Select value={newForm.geo || '_'} onValueChange={v => setNewForm(f => ({ ...f, geo: v === '_' ? '' : v }))}>
                <SelectTrigger className="w-24 h-9 text-sm"><SelectValue placeholder="GEO" /></SelectTrigger>
                <SelectContent>{GEO_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={newForm.role} onValueChange={v => setNewForm(f => ({ ...f, role: v as GeoRole }))}>
                <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-9 gap-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-semibold"
                disabled={creating} onClick={handleAdd}>
                <Plus className="w-3.5 h-3.5" /> Add User
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
