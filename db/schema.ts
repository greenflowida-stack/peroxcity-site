import { pgTable, serial, text, timestamp, integer, jsonb, boolean, uuid, index } from 'drizzle-orm/pg-core'

// A contractor (prospect or customer). Shared by the AI voice agent and the sales team.
export const leads = pgTable(
  'leads',
  {
    id: serial().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    // new | ready_to_order | qualified | nurture | contacted | won | lost
    status: text().notNull().default('new'),
    score: text(), // hot | warm | cold
    source: text().notNull().default('voice'), // voice | form | manual
    name: text(),
    company: text(),
    phone: text(),
    phoneDigits: text('phone_digits'),
    email: text(),
    city: text(),
    state: text(),
    businessType: text('business_type'),
    crewSize: text('crew_size'),
    monthlyVolume: text('monthly_volume'),
    currentChemical: text('current_chemical'),
    surfaces: text(),
    decisionMaker: text('decision_maker'),
    timeline: text(),
    interest: text(),
    summary: text(),
    nextStep: text('next_step'),
    followUpAt: timestamp('follow_up_at', { withTimezone: true }),
    owner: text(), // team member email
  },
  (t) => [index('leads_phone_digits_idx').on(t.phoneDigits), index('leads_status_idx').on(t.status)],
)

// Order requests taken by the agent (or a human). Payment is collected by the team, never on the call.
export const orders = pgTable('orders', {
  id: serial().primaryKey(),
  leadId: integer('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  // pending | checkout_sent | paid | shipped | cancelled
  status: text().notNull().default('pending'),
  items: jsonb().notNull().default([]),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  freeShipping: boolean('free_shipping').notNull().default(false),
  shipTo: jsonb('ship_to'),
  notes: text(),
  createdBy: text('created_by').notNull().default('AI agent'),
})

// Timeline: agent actions, human notes, status changes.
export const activities = pgTable(
  'activities',
  {
    id: serial().primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    author: text().notNull(),
    kind: text().notNull(), // call | note | status | order | followup | form
    body: text().notNull(),
  },
  (t) => [index('activities_lead_idx').on(t.leadId)],
)

// One voice conversation. The id doubles as the caller's session token.
export const calls = pgTable(
  'calls',
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: integer('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    outcome: text(),
    summary: text(),
    transcript: jsonb().notNull().default([]),
  },
  (t) => [index('calls_lead_idx').on(t.leadId)],
)
