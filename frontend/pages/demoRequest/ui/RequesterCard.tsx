import { User, Mail } from 'lucide-react'

type CurrentUser = {
  id: number
  email: string
  firstName: string
  lastName: string
  fullName: string
  profilePhotoUrl: string | null
}

interface Props { user: CurrentUser }

export default function RequesterCard({ user }: Props) {
  const initials = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')

  return (
    <div className="flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      {/* Avatar */}
      {user.profilePhotoUrl ? (
        <img src={user.profilePhotoUrl} alt={user.fullName}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center
                        font-bold text-base flex-shrink-0">
          {initials || <User className="w-5 h-5" />}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{user.fullName}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      {/* Submitting-as label */}
      <div className="ml-auto flex-shrink-0">
        <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100
                         px-2.5 py-1 rounded-full">
          Submitting as you
        </span>
      </div>
    </div>
  )
}
