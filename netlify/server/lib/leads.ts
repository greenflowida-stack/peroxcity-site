import { eq, desc } from 'drizzle-orm'
import { db } from '../../../db/index.ts'
import { leads, activities } from '../../../db/schema.ts'
import { digits, opt } from './util.ts'

// Fields the agent or the public form may write, mapped to their max length.
export const LEAD_FIELDS: Record<string, number> = {
  name: 120,
  company: 160,
  phone: 40,
  email: 200,
  city: 100,
  state: 2,
  businessType: 120,
  crewSize: 80,
  monthlyVolume: 120,
  currentChemical: 160,
  surfaces: 300,
  decisionMaker: 120,
  timeline: 160,
  interest: 1000,
}

export function pickLeadFields(input: Record<string, unknown>) {
  const out: Record<string, string> = {}
  for (const [k, n] of Object.entries(LEAD_FIELDS)) {
    let v = opt(input?.[k], n)
    if (v && k === 'state') v = v.toUpperCase()
    if (v) out[k] = v
  }
  return out
}

export async function logActivity(leadId: number, author: string, kind: string, body: string) {
  await db.insert(activities).values({ leadId, author, kind, body: body.slice(0, 8000) })
}

// Statuses a sales rep has moved the lead into; automation never overrides them.
const HUMAN_STATUSES = new Set(['contacted', 'won', 'lost'])

export async function setStatus(leadId: number, status: string, author: string) {
  const [lead] = await db.select({ status: leads.status }).from(leads).where(eq(leads.id, leadId))
  if (!lead || lead.status === status) return
  if (author === 'AI agent' && HUMAN_STATUSES.has(lead.status)) return
  // A prospect who is ready to order stays there until a human moves it on.
  if (author === 'AI agent' && lead.status === 'ready_to_order' && status !== 'ready_to_order') return
  await db.update(leads).set({ status, updatedAt: new Date() }).where(eq(leads.id, leadId))
  await logActivity(leadId, author, 'status', `Status: ${lead.status} → ${status}`)
}

/** Fill only the empty fields of an existing lead; log differing values for a human. */
async function mergeInto(existing: any, fields: Record<string, string>, author: string, note: string) {
  const fill: Record<string, string> = {}
  const conflicts: string[] = []
  for (const [k, v] of Object.entries(fields)) {
    const cur = existing[k]
    if (!cur) fill[k] = v
    else if (k === 'phone' && digits(cur) === digits(v)) continue
    else if (String(cur).toLowerCase() !== v.toLowerCase()) conflicts.push(`${k}: "${v}" (on file: "${cur}")`)
  }
  if (fill.phone) (fill as any).phoneDigits = digits(fill.phone)
  await db.update(leads).set({ ...fill, updatedAt: new Date() }).where(eq(leads.id, existing.id))
  if (note || conflicts.length)
    await logActivity(
      existing.id,
      author,
      'note',
      [note, conflicts.length ? `Caller gave different details — review: ${conflicts.join('; ')}` : ''].filter(Boolean).join(' '),
    )
}

/**
 * Create or update a lead from untrusted input (a caller or a web form).
 * - A lead this call created itself is updated freely.
 * - Any other existing lead (matched by phone number, or edited by the team)
 *   only gets its empty fields filled; differing values are logged for review.
 */
export async function upsertLead(opts: {
  leadId: number | null
  ownsLead: boolean
  fields: Record<string, string>
  source: string
  author: string
}): Promise<number> {
  const { fields, source, author } = opts
  const phoneDigits = digits(fields.phone)
  const now = new Date()

  if (opts.leadId) {
    if (!Object.keys(fields).length) return opts.leadId
    if (opts.ownsLead) {
      await db
        .update(leads)
        .set({ ...fields, ...(phoneDigits ? { phoneDigits } : {}), updatedAt: now })
        .where(eq(leads.id, opts.leadId))
    } else {
      const [existing] = await db.select().from(leads).where(eq(leads.id, opts.leadId))
      if (existing) await mergeInto(existing, fields, author, '')
    }
    return opts.leadId
  }

  if (phoneDigits && phoneDigits.length >= 10) {
    const [existing] = await db
      .select()
      .from(leads)
      .where(eq(leads.phoneDigits, phoneDigits))
      .orderBy(desc(leads.updatedAt))
      .limit(1)
    if (existing) {
      await mergeInto(existing, fields, author, `Returning contact via ${source === 'form' ? 'web form' : 'voice line'}.`)
      return existing.id
    }
  }

  const [row] = await db
    .insert(leads)
    .values({ ...fields, phoneDigits, source, createdAt: now, updatedAt: now })
    .returning({ id: leads.id })
  return row.id
}
