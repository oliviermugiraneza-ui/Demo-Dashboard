export const DEMO_TYPES = [
  'VIP',
  'Media',
  'External',
  'OEM support',
  'Performance Check',
  'Candidate',
  'Conference',
  'Friend& Family',
] as const

export type DemoTypeValue = typeof DEMO_TYPES[number]
