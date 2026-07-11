/**
 * Seeds public.post_demo with sample records using the clean single-model schema.
 * Run with: npm run seed-post-demo
 * Safe to rerun — DELETEs all rows first, then inserts fresh.
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

async function findDemoId(geo: string, date: string): Promise<number | null> {
  try {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM public.demo_master
       WHERE UPPER(TRIM(geo)) = $1
         AND date_of_demo::date = $2
       LIMIT 1`,
      [geo.toUpperCase(), date],
    )
    return result.rows[0] ? Number(result.rows[0].id) : null
  } catch {
    return null
  }
}

interface SeedRow {
  geo: string
  category: string
  demo_date: string
  demo_time: string
  demo_type: string
  guest_organization: string
  demo_route: string
  vehicle: string
  vehicle_id: string
  operator_email: string
  operator_name: string
  model_name: string
  safety_score: number
  comfort_score: number
  decisiveness_score: number
  aggressiveness_score: number
  speed_following_score: number
  model_behaviours: string[]
  positive_behaviour: string
  problem_description: string
  smoothness_score: number
  number_of_uds: number
  safety_critical: boolean
  interventions: Record<string, number>
  demo_issues: string[]
  reason_for_power_cycle: string | null
  power_cycle_required: boolean
  driving_features: string[]
}

async function run() {
  console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'))

  try {
    await pool.query('DELETE FROM public.post_demo')
    console.log('🗑️  Cleared existing post_demo rows')

    const rows: SeedRow[] = [
      {
        geo: 'UK', category: 'demo', demo_date: '2026-03-10', demo_time: '10:00',
        demo_type: 'VIP', guest_organization: 'Wayve Investors',
        demo_route: 'Kings Road Circuit', vehicle: 'KU-W01', vehicle_id: 'KU-W01',
        operator_email: 'james.walker@wayve.ai', operator_name: 'James Walker',
        model_name: 'sapient-osprey-bronze',
        safety_score: 8, comfort_score: 7, decisiveness_score: 8, aggressiveness_score: 3, speed_following_score: 7,
        model_behaviours: ['Smooth braking', 'Good gap management'],
        positive_behaviour: 'Confident in complex junctions',
        problem_description: 'Slight hesitation at roundabouts',
        smoothness_score: 4, number_of_uds: 0, safety_critical: false,
        interventions: { give_way: 1 },
        demo_issues: [], reason_for_power_cycle: null, power_cycle_required: false,
        driving_features: ['PUDO'],
      },
      {
        geo: 'JP', category: 'demo', demo_date: '2026-03-14', demo_time: '14:00',
        demo_type: 'Candidate', guest_organization: 'Honda R&D',
        demo_route: 'Shinjuku Loop', vehicle: 'JP-E12', vehicle_id: 'JP-E12',
        operator_email: 'yuki.tanaka@wayve.ai', operator_name: 'Yuki Tanaka',
        model_name: 'owl-violet-neighbourly',
        safety_score: 6, comfort_score: 8, decisiveness_score: 7, aggressiveness_score: 4, speed_following_score: 6,
        model_behaviours: ['Twitching (slight jerky)', 'Harsh braking'],
        positive_behaviour: 'Smooth ride quality',
        problem_description: 'Unexpected deceleration near crossings',
        smoothness_score: 3, number_of_uds: 1, safety_critical: true,
        interventions: { pedestrian_crossing: 1, give_way: 2 },
        demo_issues: ['UI crash'], reason_for_power_cycle: null, power_cycle_required: false,
        driving_features: ['PUDO', 'MRM'],
      },
      {
        geo: 'US', category: 'demo', demo_date: '2026-03-18', demo_time: '09:30',
        demo_type: 'Media', guest_organization: 'TechCrunch',
        demo_route: 'Market St Loop', vehicle: 'US-A05', vehicle_id: 'US-A05',
        operator_email: 'mike.chen@wayve.ai', operator_name: 'Mike Chen',
        model_name: 'falcon-azure-prime',
        safety_score: 9, comfort_score: 9, decisiveness_score: 8, aggressiveness_score: 2, speed_following_score: 8,
        model_behaviours: ['Smooth acceleration', 'Confident lane discipline'],
        positive_behaviour: 'Very smooth ride, no harsh events',
        problem_description: 'None',
        smoothness_score: 5, number_of_uds: 0, safety_critical: false,
        interventions: {},
        demo_issues: [], reason_for_power_cycle: null, power_cycle_required: false,
        driving_features: ['Parking'],
      },
      {
        geo: 'DE', category: 'demo', demo_date: '2026-03-22', demo_time: '11:00',
        demo_type: 'External', guest_organization: 'BMW Group',
        demo_route: 'Munich City Loop', vehicle: 'DE-B03', vehicle_id: 'DE-B03',
        operator_email: 'hans.mueller@wayve.ai', operator_name: 'Hans Müller',
        model_name: 'hawk-silver-steady',
        safety_score: 7, comfort_score: 6, decisiveness_score: 6, aggressiveness_score: 5, speed_following_score: 7,
        model_behaviours: ['Assertive merging', 'Tight following distance'],
        positive_behaviour: 'Strong expressway performance',
        problem_description: 'Too aggressive in urban environment',
        smoothness_score: 3, number_of_uds: 2, safety_critical: false,
        interventions: { speed_inappropriate: 1, incorrect_lane: 1 },
        demo_issues: ['Power cycle'], reason_for_power_cycle: 'Software restart required', power_cycle_required: true,
        driving_features: ['Set/Over speed'],
      },
      {
        geo: 'UK', category: 'brt', demo_date: '2026-04-01', demo_time: '09:00',
        demo_type: '', guest_organization: '',
        demo_route: 'BRT Track A', vehicle: 'KU-BRT01', vehicle_id: 'KU-BRT01',
        operator_email: 'sarah.jones@wayve.ai', operator_name: 'Sarah Jones',
        model_name: 'eagle-gold-calm',
        safety_score: 8, comfort_score: 8, decisiveness_score: 7, aggressiveness_score: 3, speed_following_score: 8,
        model_behaviours: ['Consistent speed', 'Smooth cornering'],
        positive_behaviour: 'Very stable in all scenarios',
        problem_description: 'Minor issue with narrow road edge',
        smoothness_score: 5, number_of_uds: 0, safety_critical: false,
        interventions: {},
        demo_issues: [], reason_for_power_cycle: null, power_cycle_required: false,
        driving_features: [],
      },
      {
        geo: 'JP', category: 'brt', demo_date: '2026-04-05', demo_time: '10:30',
        demo_type: '', guest_organization: '',
        demo_route: 'BRT Track JP-1', vehicle: 'JP-BRT01', vehicle_id: 'JP-BRT01',
        operator_email: 'kenji.sato@wayve.ai', operator_name: 'Kenji Sato',
        model_name: 'sparrow-cyan-focus',
        safety_score: 7, comfort_score: 7, decisiveness_score: 8, aggressiveness_score: 4, speed_following_score: 7,
        model_behaviours: ['Precise turning', 'Responsive braking'],
        positive_behaviour: 'Great low-speed handling',
        problem_description: 'Occasional speed fluctuation on straight',
        smoothness_score: 4, number_of_uds: 1, safety_critical: false,
        interventions: { failed_to_maintain_speed: 2 },
        demo_issues: ['UDs (uncommanded)'], reason_for_power_cycle: null, power_cycle_required: false,
        driving_features: [],
      },
      {
        geo: 'UK', category: 'recce', demo_date: '2026-04-10', demo_time: '08:00',
        demo_type: '', guest_organization: '',
        demo_route: 'Chelsea New Route', vehicle: 'KU-W02', vehicle_id: 'KU-W02',
        operator_email: 'james.walker@wayve.ai', operator_name: 'James Walker',
        model_name: 'osprey-beta-v2',
        safety_score: 7, comfort_score: 6, decisiveness_score: 7, aggressiveness_score: 3, speed_following_score: 6,
        model_behaviours: ['Conservative lane change', 'Good pedestrian awareness'],
        positive_behaviour: 'Route survey completed without incidents',
        problem_description: 'Camera artefacts on narrow street',
        smoothness_score: 3, number_of_uds: 0, safety_critical: false,
        interventions: { lane_change_unnecessary: 1 },
        demo_issues: ['Map/ Navigation'], reason_for_power_cycle: null, power_cycle_required: false,
        driving_features: ['Parking'],
      },
    ]

    for (const row of rows) {
      const demoId = await findDemoId(row.geo, row.demo_date)

      await pool.query(
        `INSERT INTO public.post_demo (
          demo_id, geo, category, demo_date, demo_time, demo_type,
          guest_organization, demo_route, vehicle, vehicle_id,
          operator_email, operator_name,
          model_name, model_behaviours, positive_behaviour, problem_description,
          safety_score, comfort_score, decisiveness_score, aggressiveness_score, speed_following_score,
          smoothness_score, number_of_uds, safety_critical,
          interventions, demo_issues, reason_for_power_cycle, power_cycle_required,
          driving_features, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24,
          $25, $26, $27, $28,
          $29, 'submitted'
        )`,
        [
          demoId, row.geo, row.category, row.demo_date, row.demo_time, row.demo_type || null,
          row.guest_organization || null, row.demo_route || null, row.vehicle || null, row.vehicle_id,
          row.operator_email, row.operator_name,
          row.model_name, row.model_behaviours, row.positive_behaviour || null, row.problem_description || null,
          row.safety_score, row.comfort_score, row.decisiveness_score, row.aggressiveness_score, row.speed_following_score,
          row.smoothness_score, row.number_of_uds, row.safety_critical,
          JSON.stringify(row.interventions), row.demo_issues, row.reason_for_power_cycle, row.power_cycle_required,
          row.driving_features,
        ],
      )
    }

    console.log(`✅  Inserted ${rows.length} post_demo records`)
  } catch (err) {
    console.error('❌  Seed failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

void run()
