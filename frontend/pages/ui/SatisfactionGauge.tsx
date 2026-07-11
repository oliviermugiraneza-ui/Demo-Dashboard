import { useRef, useEffect } from 'react'
import { PieChart, Pie, Cell } from 'recharts'

interface Props {
  score: number          // 0 = no data, 1–5 otherwise
  feedbackCount?: number
}

const SEGS = [
  { color: '#EF4444' }, // 1 — Poor
  { color: '#F97316' }, // 2 — Fair
  { color: '#EAB308' }, // 3 — Good
  { color: '#86EFAC' }, // 4 — Great
  { color: '#10B981' }, // 5 — Excellent
]

const SEG_DATA = SEGS.map(() => ({ value: 1 }))

const LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent']

const W  = 240
const H  = 130
const CX = W / 2
const CY = H
const R  = 73

export default function SatisfactionGauge({ score, feedbackCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    if (score <= 0) return

    const clamped = Math.max(1, Math.min(5, score))
    const angleDeg = 180 - ((clamped - 1) / 4) * 180
    const rad = (angleDeg * Math.PI) / 180

    const nx = CX + R * Math.cos(rad)
    const ny = CY - R * Math.sin(rad)

    ctx.beginPath()
    ctx.moveTo(CX, CY)
    ctx.lineTo(nx, ny)
    ctx.strokeStyle = '#1E293B'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(CX, CY, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#1E293B'
    ctx.fill()
  }, [score])

  // Which label bucket is active (0-indexed, -1 = no data)
  const activeIdx = score > 0 ? Math.round(Math.max(1, Math.min(5, score))) - 1 : -1
  const activeColor = activeIdx >= 0 ? SEGS[activeIdx].color : undefined

  return (
    <div className="flex flex-col items-center">
      {/* Gauge arc + needle */}
      <div className="relative" style={{ width: W, height: H }}>
        <PieChart width={W} height={H} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={SEG_DATA}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
            strokeWidth={0}
          >
            {SEGS.map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
        </PieChart>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="absolute inset-0 pointer-events-none"
        />
      </div>

      {/* Scale labels — active one is bold black */}
      <div className="flex justify-between w-full px-1 mt-4" style={{ maxWidth: W }}>
        {LABELS.map((l, i) => (
          <span
            key={l}
            className={
              i === activeIdx
                ? 'text-[11px] font-bold text-[#0F172A]'
                : 'text-[10px] text-[#94A3B8]'
            }
          >
            {l}
          </span>
        ))}
      </div>

      {/* Feedback count */}
      {feedbackCount !== undefined && feedbackCount > 0 && (
        <p className="text-[10px] text-[#94A3B8] mt-3">
          Based on {feedbackCount} feedback record{feedbackCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
