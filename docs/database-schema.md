# Demo Dashboard — Database Schema Reference

> **Version:** 1.6.1  
> **Last updated:** 2026-07-11  
> **Database:** PostgreSQL (Docker local → Lakebase production)

---

## Table Relationship Diagram

```
admin_users
  └── (no FK — Admin/Super Admin only, separate from hosts/operators)

hosts
  └── (no FK — referenced by demo_master.host via text name)

operators
  └── (no FK — referenced by post_demo.operator_name via text name)

models
  └── (no FK — referenced by post_demo.model_name via text name)

routes
  └── (no FK — referenced by post_demo.route via text name)

vehicles
  └── (no FK — referenced by post_demo.vehicle_id via text name)

demo_master (primary demo table)
  ├── post_demo.demo_id → demo_master.id  (ON DELETE SET NULL)
  └── notification_log.demo_id → demo_master.id  (ON DELETE SET NULL)

demo_backlog (pre-demo pipeline)
  └── demo_backlog.converted_demo_id → demo_master.id  (soft reference, no FK)

satisfaction (Google Form survey responses)
  └── (no FK — linked by date/operator name, not demo_id)

schema_version (migration history)
  └── (standalone audit table)
```

---

## Tables

### `demo_master`

Primary record for every demo request/event.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | bigserial | NOT NULL PK | Auto-increment |
| demo_ref | text | NOT NULL UNIQUE | Format: `GEO-YYMMDD-SEQ` (e.g. `UK-260704-01`) |
| status | text | NOT NULL | See status enum below |
| geo | text | NOT NULL | See geo enum below |
| type | text | | See demo type enum below |
| date_of_demo | date | | |
| demo_start_time | timestamp | | |
| demo_end_time | timestamp | | |
| length | text | | Human-readable duration |
| total_guests | integer | | |
| total_vehicles | integer | | |
| vehicle_type | text | | |
| system_required | text | | Platform/system notes |
| start_location | text | | Pick-up location |
| recce_required | text | | Yes/No/NA |
| host | text | | Host name (text reference to hosts table) |
| requester | text | | Who requested the demo |
| approver | text | | Who approved it |
| guests_organization | text | | Guest company |
| route_type | text | | Route classification |
| feature_type | text | | AV feature focus |
| channel | text | | Communication channel (Slack, Email, etc.) |
| slack_link | text | | Slack thread URL |
| calendar_event_link | text | | Google Calendar URL |
| calendar_event_id | text | | Google Calendar event ID |
| local_demo | boolean | | True if not cross-geo |
| cross_geo_demo | boolean | | True if staff from another geo |
| number_of_sessions_event | integer | | For multi-session events |
| date_request_received | timestamp | | When request was logged |
| lead_time_days | integer | | Days from request to demo |
| cancelation_reason | text | | Reason if CANCELED |
| date_of_readiness | text | | Readiness confirmation date |
| date_month | text | | Month label (legacy) |
| description | text | | Free-text notes |
| created_at / updated_at | timestamp | | Audit timestamps |

**CHECK constraints:**
- `status IN ('NEED REVIEW','APPROVED','CANCELED','COMPLETED','DELETED')`
- `TRIM(geo) IN ('JP','UK','US','DE')`
- `type IN ('VIP','Media','External','OEM support','Performance Check','Candidate','Conference','Friend& Family')`

**Indexes:** id (PK), demo_ref (UNIQUE), status, geo, date_of_demo, host, type, requester

---

### `demo_backlog`

Pre-request pipeline. Items are promoted to `demo_master` via Convert action.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | bigserial | NOT NULL PK | |
| status | text | NOT NULL | Backlog-specific lifecycle (see below) |
| company | text | | Guest company name |
| customer | text | | Primary contact |
| requestor | text | | Who requested |
| host | text | | Assigned host |
| window_person | text | | Key liaison |
| preferred_demo_date | text | | YYYY-MM-DD or legacy text |
| preferred_time | text | | HH:MM |
| demo_purpose | text | | Why the demo is needed |
| demo_route | text | | Preferred route |
| vehicle | text | | Requested vehicle |
| expected_performance | text | | Goals |
| priority | text | | P0 / P1 / P2 |
| ticket_link | text | | Jira/Linear link |
| notes | text | | Free-text |
| geo | text | | JP/UK/US/DE |
| demo_type | text | | VIP, External, etc. |
| converted_demo_id | bigint | | ID in demo_master after conversion |
| converted_demo_ref | text | | demo_ref after conversion |
| converted_at | timestamp | | When converted |
| created_by / updated_by | text | | Audit user |
| created_at / updated_at | timestamp | | Audit timestamps |

**Backlog status lifecycle:**
```
Proposed → Requested → Arranging → Confirmed → Completed
                                              → CANCELED
                                              → Converted (promoted to demo_master)
```

**Indexes:** id (PK), status, host (updated_at), geo, demo_type, priority

---

### `post_demo`

Operational feedback submitted after each demo run.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | bigserial | NOT NULL PK | |
| demo_id | bigint | | FK → demo_master.id (ON DELETE SET NULL) |
| demo_ref | text | | Copied from demo_master |
| category | text | NOT NULL | 'brt' / 'demo' / 'recce' |
| geo | text | NOT NULL | JP/UK/US/DE |
| vehicle_id | text | NOT NULL | Vehicle identifier |
| model_name | text | NOT NULL | AV model name |
| status | text | | 'submitted' (default) |
| operator_email | text | | Submitter |
| operator_name | text | | Operator full name |
| demo_date | date | | |
| demo_time | text | | HH:MM |
| demo_type | text | | |
| guest_organization | text | | |
| demo_route | text | | Legacy route field |
| route | text | | Primary route field (newer) |
| vehicle | text | | Vehicle display name |
| model_behaviours | text[] | | Selected model behaviour tags |
| driving_features | text[] | | |
| demo_issues | text[] | | |
| safety_score | integer | | 1–5 |
| comfort_score | integer | | 1–5 |
| decisiveness_score | integer | | 1–5 |
| aggressiveness_score | integer | | 1–5 |
| speed_following_score | integer | | **Legacy** — no longer collected by form |
| smoothness_score | integer | | 1–5 |
| interventions | jsonb | | `{ "type": count, ... }` |
| interventions_sc | jsonb | | Safety-critical flags per intervention type |
| safety_critical | boolean | | Overall SC flag |
| number_of_uds | integer | | UDS count |
| power_cycle_required | boolean | | |
| reason_for_power_cycle | text | | |
| problem_description | text | | |
| positive_behaviour | text | | |
| submitted_at / created_at / updated_at | timestamp | | |

**Note on route columns:** `route` is the primary column; `demo_route` is legacy kept for backward compatibility (PostDemoPage displays `route ?? demo_route`).

**Indexes:** id (PK), demo_id, demo_ref, geo, model_name, operator_name, route, vehicle, submitted_at, category, demo_date

---

### `hosts`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| full_name | text NOT NULL | |
| email | text NOT NULL UNIQUE | |
| geo | text NOT NULL | JP/UK/US/DE |
| role | text NOT NULL | Always `'Host'` |
| created_at / updated_at | timestamp | |

---

### `operators`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| full_name | text NOT NULL | |
| email | text NOT NULL UNIQUE | |
| geo | text NOT NULL | |
| role | text NOT NULL | Always `'Operator'` |
| created_at / updated_at | timestamp | |

---

### `admin_users`

Admin portal users only (NOT hosts or operators).

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| full_name | text NOT NULL | |
| email | text NOT NULL UNIQUE | |
| password | text | Hashed |
| geo | text NOT NULL | |
| role | text NOT NULL | `'Admin'` or `'Super Admin'` |
| created_at / updated_at | timestamp | |

---

### `models`

AV vehicle models available for demos.

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| model_name | text NOT NULL | |
| platform | text NOT NULL | Default: `'dGPU'` |
| baseline_tag | boolean NOT NULL | Whether it's a baseline model |
| geo | text NOT NULL | |
| created_at / updated_at | timestamp | |

---

### `routes`

Named demo routes per GEO.

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| route_name | text NOT NULL | |
| console_link | text | Link to route console |
| geo | text NOT NULL | |
| created_at / updated_at | timestamp | |

---

### `vehicles`

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| vehicle_id | text NOT NULL UNIQUE | |
| vehicle_type | text NOT NULL | Default: `'Nvidia'` |
| geo | text NOT NULL | |
| created_at / updated_at | timestamp | |

---

### `notification_log`

Audit trail for all email/notification events.

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| demo_id | bigint | FK → demo_master.id (ON DELETE SET NULL) |
| event_type | text | e.g. `demo_approved`, `demo_cancelled` |
| channel | text | `email`, `slack`, etc. |
| recipient | text | Target email address |
| payload | jsonb | Full notification payload |
| success | boolean | Whether delivery succeeded |
| error_message | text | Error detail if failed |
| created_at | timestamp | |

**Indexes:** id (PK), demo_id, event_type, created_at, recipient

---

### `satisfaction`

Google Form survey responses (imported/synced).

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| timestamp_text | text | Raw form submission timestamp |
| email_address | text | Respondent email |
| date_of_demo | text | Date string from form |
| geo | text | |
| communication_rating | text | 1–5 text |
| operator_professionalism_rating | text | |
| route_fit_rating | text | |
| overall_satisfaction | text | |
| technical_operational_issues | text | Yes/No |
| issue_description | text | |
| comments_suggestions | text | |
| demo_operator_jp/de/uk/us | text | Operator name per GEO |

**Indexes:** id (PK), geo, date_of_demo

---

### `schema_version`

Migration history audit trail.

| Column | Type | Notes |
|--------|------|-------|
| id | bigserial PK | |
| version | text NOT NULL UNIQUE | SemVer (e.g. `1.6.1`) |
| description | text | What changed |
| applied_at | timestamp | Default NOW() |

---

## Status Enums

### `demo_master.status` (enforced by CHECK constraint)

| Value | Color | Meaning |
|-------|-------|---------|
| `NEED REVIEW` | Amber | Submitted, awaiting approval |
| `APPROVED` | Green | Approved, not yet completed |
| `CANCELED` | Red | Canceled by ops or requester |
| `COMPLETED` | Blue | Demo completed |
| `DELETED` | Grey | Soft-deleted, hidden from UI |

### `demo_backlog.status` (separate lifecycle)

| Value | Meaning |
|-------|---------|
| `Proposed` | Initial proposal |
| `Requested` | Formal request made |
| `Arranging` | Logistics in progress |
| `Confirmed` | Confirmed and scheduled |
| `Completed` | Demo happened (backlog closure) |
| `CANCELED` | Canceled |
| `Converted` | Promoted to demo_master |

---

## GEO Values

| Code | Location |
|------|----------|
| `JP` | Japan |
| `UK` | United Kingdom |
| `US` | United States |
| `DE` | Germany |

---

## Demo Type Values

| Value | Notes |
|-------|-------|
| `VIP` | VIP guest experience |
| `External` | External stakeholder |
| `Media` | Press/media visit |
| `OEM support` | OEM partner support |
| `Candidate` | Recruitment demo |
| `Friend& Family` | Staff friends & family |
| `Conference` | Conference/event demo |
| `Performance Check` | Internal performance verification |
