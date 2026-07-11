/**
 * Resets and creates public.post_demo with the clean single-model schema.
 * Run with: npm run migrate-post-demo
 * Safe to rerun — drops and recreates the table each time.
 */
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

const SQL = `
DROP TABLE IF EXISTS public.post_demo CASCADE;

CREATE TABLE public.post_demo (
  id                    BIGSERIAL PRIMARY KEY,
  demo_id               BIGINT REFERENCES public.demo_master(id) ON DELETE SET NULL,
  demo_ref              TEXT,
  category              TEXT NOT NULL,
  status                TEXT DEFAULT 'submitted',
  submitted_at          TIMESTAMP DEFAULT NOW(),
  operator_email        TEXT,
  operator_name         TEXT,
  geo                   TEXT NOT NULL,
  demo_date             DATE,
  demo_time             TEXT,
  demo_type             TEXT,
  guest_organization    TEXT,
  demo_route            TEXT,
  vehicle               TEXT,
  vehicle_id            TEXT NOT NULL,
  model_name            TEXT NOT NULL,
  model_behaviours      TEXT[],
  problem_description   TEXT,
  positive_behaviour    TEXT,
  safety_score          INTEGER,
  comfort_score         INTEGER,
  decisiveness_score    INTEGER,
  aggressiveness_score  INTEGER,
  speed_following_score INTEGER,
  driving_features      TEXT[],
  demo_issues           TEXT[],
  number_of_uds         INTEGER,
  power_cycle_required  BOOLEAN,
  reason_for_power_cycle TEXT,
  interventions         JSONB DEFAULT '{}'::jsonb,
  safety_critical       BOOLEAN,
  smoothness_score      INTEGER,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_post_demo_demo_id       ON public.post_demo(demo_id);
CREATE INDEX idx_post_demo_demo_ref      ON public.post_demo(demo_ref);
CREATE INDEX idx_post_demo_geo           ON public.post_demo(geo);
CREATE INDEX idx_post_demo_demo_date     ON public.post_demo(demo_date);
CREATE INDEX idx_post_demo_category      ON public.post_demo(category);
CREATE INDEX idx_post_demo_model_name    ON public.post_demo(model_name);
CREATE INDEX idx_post_demo_operator_name ON public.post_demo(operator_name);
`

async function run() {
  console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'))
  try {
    await pool.query(SQL)
    console.log('✅  public.post_demo reset with clean single-model schema')
    console.log('✅  Indexes created')
  } catch (err) {
    console.error('❌  Migration failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

void run()
