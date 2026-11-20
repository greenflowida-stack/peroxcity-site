// Team CRM API. Every route requires a logged-in Netlify Identity user with the
// "admin" or "sales" role. The session cookie (nf_jwt) or a Bearer token is
// verified against the site's Identity service on each request.
import { and, desc, eq, ilike, or, sql, inArray } from 'drizzle-orm'
import { db } from '../../../db/index.ts'
import { leads, orders, activities, calls } from '../../../db/schema.ts'
import { json, opt, readJson, digits } from './util.ts'
import { LEAD_FIELDS, logActivity, setStatus, upsertLead, pickLeadFields } from './leads.ts'

const TEAM_ROLES = ['admin', 'sales']
const STATUSES = ['new', 'ready_to_order', 'qualified', 'nurture', 'contacted', 'won', 'lost']
const ORDER_STATUSES = ['pending', 'checkout_sent', 'paid', 'shipped', 'cancelled']
const SCORES = ['hot', 'warm', 'cold']

type TeamUser = { email: string; name: string; roles: string[] }

function tokenFrom(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)nf_jwt=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

async function teamUser(req: Request): Promise<TeamUser | 'unauthenticated' | 'forbidden'> {
  const token = tokenFrom(req)
  if (!token) return 'unauthenticated'
  const r = await fetch(new URL('/.netlify/identity/user', req.url), { headers: { authorization: `Bearer ${token}` } }).catch(() => null)
  if (!r || !r.ok) return 'unauthenticated'
  const u: any = await r.json()
  const roles: string[] = u?.app_metadata?.roles || []
  if (!roles.some((x) => TEAM_ROLES.includes(x))) return 'forbidden'
  return { email: u.email, name: u.user_metadata?.full_name || u.email, roles }
}

export async function crm(req: Request, path: string) {
  const user = await teamUser(req)
  if (user === 'unauthenticated') return json({ error: 'Log in to use the CRM.' }, 401)
  if (user === 'forbidden') return json({ error: 'Your account does not have CRM access yet. Ask an admin to add the "sales" role.' }, 403)
  if (req.method !== 'GET' && !(req.headers.get('content-type') || '').includes('application/json'))
    return json({ error: 'Expected JSON' }, 415)

  const author = user.name
  const seg = path.replace(/^\/api\/crm\/?/, '').split('/').filter(Boolean)

  // GET /api/crm/me
  if (seg[0] === 'me' && req.method === 'GET') return json({ email: user.email, name: user.name, roles: user.roles })

  // GET /api/crm/leads?status=&q=&owner=
  if (seg[0] === 'leads' && seg.length === 1 && req.method === 'GET') {
    const u = new URL(req.url)
    const status = u.searchParams.get('status')
    const q = opt(u.searchParams.get('q'), 100)
    const owner = u.searchParams.get('owner')
    const where = [] as any[]
    if (status && STATUSES.includes(status)) where.push(eq(leads.status, status))
    if (owner === 'me') where.push(eq(leads.owner, user.email))
    if (owner === 'unassigned') where.push(sql`${leads.owner} is null`)
    if (q) {
      const like = `%${q.replace(/[%_]/g, '')}%`
      const d = digits(q)
      where.push(or(ilike(leads.name, like), ilike(leads.company, like), ilike(leads.email, like), ilike(leads.city, like), ...(d && d.length >= 3 ? [ilike(leads.phoneDigits, `%${d}%`)] : [])))
    }
    const rows = await db
      .select()
      .from(leads)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(leads.updatedAt))
      .limit(300)
    const counts = await db.select({ status: leads.status, n: sql<number>`count(*)::int` }).from(leads).groupBy(leads.status)
    const ids = rows.map((r) => r.id)
    const openOrders = ids.length
      ? await db
          .select({ leadId: orders.leadId, n: sql<number>`count(*)::int`, total: sql<number>`sum(${orders.subtotalCents})::int` })
          .from(orders)
          .where(and(inArray(orders.leadId, ids), inArray(orders.status, ['pending', 'checkout_sent'])))
          .groupBy(orders.leadId)
      : []
    const byLead = Object.fromEntries(openOrders.map((o) => [o.leadId, o]))
    return json({
      leads: rows.map((r) => ({ ...r, openOrders: byLead[r.id]?.n || 0, openOrderCents: byLead[r.id]?.total || 0 })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    })
  }

  // POST /api/crm/leads (manual entry)
  if (seg[0] === 'leads' && seg.length === 1 && req.method === 'POST') {
    const body = await readJson(req)
    const fields = pickLeadFields(body || {})
    if (!fields.name && !fields.company && !fields.phone) return json({ error: 'Add at least a name, company or phone.' }, 400)
    const id = await upsertLead({ leadId: null, ownsLead: false, fields, source: 'manual', author })
    await db.update(leads).set({ owner: user.email }).where(and(eq(leads.id, id), sql`${leads.owner} is null`))
    await logActivity(id, author, 'note', 'Lead added by hand.')
    return json({ id }, 201)
  }

  const leadId = seg[0] === 'leads' ? Number(seg[1]) : NaN

  // GET /api/crm/leads/:id
  if (seg[0] === 'leads' && seg.length === 2 && req.method === 'GET') {
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId))
    if (!lead) return json({ error: 'Not found' }, 404)
    const [o, a, c] = await Promise.all([
      db.select().from(orders).where(eq(orders.leadId, leadId)).orderBy(desc(orders.createdAt)),
      db.select().from(activities).where(eq(activities.leadId, leadId)).orderBy(desc(activities.createdAt)).limit(300),
      db.select().from(calls).where(eq(calls.leadId, leadId)).orderBy(desc(calls.createdAt)).limit(50),
    ])
    return json({ lead, orders: o, activities: a, calls: c })
  }

  // PATCH /api/crm/leads/:id
  if (seg[0] === 'leads' && seg.length === 2 && req.method === 'PATCH') {
    const body = await readJson(req)
    if (!body) return json({ error: 'Invalid JSON' }, 400)
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId))
    if (!lead) return json({ error: 'Not found' }, 404)
    const set: Record<string, any> = {}
    for (const k of [...Object.keys(LEAD_FIELDS), 'summary', 'nextStep']) {
      if (k in body) set[k] = opt(body[k], k === 'summary' ? 4000 : (LEAD_FIELDS[k] ?? 300))
    }
    if (set.state) set.state = String(set.state).toUpperCase()
    if ('phone' in set) set.phoneDigits = digits(set.phone)
    if ('score' in body) set.score = SCORES.includes(body.score) ? body.score : null
    if ('owner' in body) set.owner = body.owner === 'me' ? user.email : opt(body.owner, 200)
    if ('followUpAt' in body) {
      const d = body.followUpAt ? new Date(body.followUpAt) : null
      set.followUpAt = d && !isNaN(d.getTime()) ? d : null
    }
    if (Object.keys(set).length) {
      await db.update(leads).set({ ...set, updatedAt: new Date() }).where(eq(leads.id, leadId))
      if ('owner' in set && set.owner !== lead.owner) await logActivity(leadId, author, 'note', set.owner ? `Assigned to ${set.owner}` : 'Unassigned')
    }
    if (body.status && STATUSES.includes(body.status)) await setStatus(leadId, body.status, author)
    return json({ ok: true })
  }

  // POST /api/crm/leads/:id/notes
  if (seg[0] === 'leads' && seg[2] === 'notes' && req.method === 'POST') {
    const body = await readJson(req)
    const text = opt(body?.body, 4000)
    if (!text) return json({ error: 'Note is empty' }, 400)
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, leadId))
    if (!lead) return json({ error: 'Not found' }, 404)
    await logActivity(leadId, author, 'note', text)
    await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, leadId))
    return json({ ok: true }, 201)
  }

  // PATCH /api/crm/orders/:id
  if (seg[0] === 'orders' && seg.length === 2 && req.method === 'PATCH') {
    const id = Number(seg[1])
    const body = await readJson(req)
    const [order] = await db.select().from(orders).where(eq(orders.id, id))
    if (!order) return json({ error: 'Not found' }, 404)
    const set: Record<string, any> = {}
    if (body?.status && ORDER_STATUSES.includes(body.status)) set.status = body.status
    if (body && 'notes' in body) set.notes = opt(body.notes, 1000)
    if (!Object.keys(set).length) return json({ ok: true })
    await db.update(orders).set({ ...set, updatedAt: new Date() }).where(eq(orders.id, id))
    if (set.status && set.status !== order.status) {
      await logActivity(order.leadId, author, 'order', `Order #${id}: ${order.status} → ${set.status}`)
      if (set.status === 'paid' || set.status === 'shipped') await setStatus(order.leadId, 'won', author)
    }
    await db.update(leads).set({ updatedAt: new Date() }).where(eq(leads.id, order.leadId))
    return json({ ok: true })
  }

  return json({ error: 'Not found' }, 404)
}
