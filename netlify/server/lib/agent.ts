// PeroXcity sales line — AI voice agent for contractors.
// Each caller turn runs an agent loop: Claude talks to the contractor, finds out
// whether they are ready to order or should be qualified as a prospect, and
// writes everything into the shared CRM (leads, orders, follow-ups, call log).
import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/index.ts'
import { leads, orders, calls } from '../../../db/schema.ts'
import { json, clip, opt, readJson, priceItems, dollars, NOT_LOWER_48 } from './util.ts'
import { pickLeadFields, upsertLead, logActivity, setStatus } from './leads.ts'

const client = new Anthropic()
const MODEL = 'claude-opus-5-5'
const AGENT = 'AI agent'
const MAX_TOOL_ROUNDS = 6
const MAX_HISTORY_BYTES = 400_000
const CALL_TTL_MS = 3 * 60 * 60 * 1000

const nullable = (description: string) => ({ type: ['string', 'null'], description })

const TOOLS: any[] = [
  {
    name: 'update_lead',
    description:
      'Save what you have learned about the caller to the CRM. Call it whenever you learn something new (name, company, phone, location, business details, buying signals). Pass null for anything you have not learned. The sales team reads this record.',
    input_schema: {
      type: 'object',
      properties: {
        name: nullable('Caller full name'),
        company: nullable('Company name'),
        phone: nullable('Best phone number, digits as spoken'),
        email: nullable('Email address'),
        city: nullable('City'),
        state: nullable('Two-letter US state code'),
        businessType: nullable('e.g. soft wash, pressure washing, roofing, property management, commercial kitchen cleaning, marine detailing'),
        crewSize: nullable('Crews, rigs or technicians, e.g. "2 rigs, 5 techs"'),
        monthlyVolume: nullable('Chemical used per month, e.g. "about 40 gallons of bleach"'),
        currentChemical: nullable('What they use today, e.g. bleach (sodium hypochlorite), another peroxide product'),
        surfaces: nullable('Main jobs or surfaces: roofs, pavers, house washes, decks, hoods…'),
        decisionMaker: nullable('Whether the caller makes purchasing decisions, or who does'),
        timeline: nullable('When they could buy or switch, e.g. "ready today", "after season", "testing next month"'),
        interest: nullable('Pain points, objections, questions, what got them interested'),
      },
      required: ['name', 'company', 'phone', 'email', 'city', 'state', 'businessType', 'crewSize', 'monthlyVolume', 'currentChemical', 'surfaces', 'decisionMaker', 'timeline', 'interest'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'create_order',
    description:
      'Record an order for a caller who is ready to buy concentrate kits or Ready-To-Use. Only call after the caller confirms the items and quantities, and you have their name, phone, email and a lower-48 shipping address. Returns the price. A team member then sends a secure checkout link; never take card details on the call.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product: { type: 'string', enum: ['concentrate_kit', 'rtu_1gal', 'rtu_5gal'] },
              quantity: { type: 'integer' },
            },
            required: ['product', 'quantity'],
            additionalProperties: false,
          },
        },
        ship_to_name: { type: 'string' },
        street: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string', description: 'Two-letter state code' },
        zip: { type: 'string' },
        notes: nullable('Delivery notes, discount code mentioned, anything the team needs'),
      },
      required: ['items', 'ship_to_name', 'street', 'city', 'state', 'zip', 'notes'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'request_followup',
    description:
      'Ask a human on the sales team to follow up: bulk drums/totes or fleet pricing quotes, questions you cannot answer, a caller who wants to talk to a person, or a prospect who agreed to a callback.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'What the team should do and why' },
        urgency: { type: 'string', enum: ['today', 'this_week', 'later'] },
        best_time: nullable('When to reach them'),
        channel: { type: 'string', enum: ['call', 'text', 'email'] },
      },
      required: ['reason', 'urgency', 'best_time', 'channel'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'finish_call',
    description: 'Close out the call in the CRM. Call this once, just before you say goodbye.',
    input_schema: {
      type: 'object',
      properties: {
        outcome: { type: 'string', enum: ['ready_to_order', 'qualified_prospect', 'nurture', 'not_a_fit', 'support_only'] },
        score: { type: 'string', enum: ['hot', 'warm', 'cold'] },
        summary: { type: 'string', description: 'Two to four sentences for the sales team' },
        next_step: { type: 'string', description: 'The single next action for a human' },
      },
      required: ['outcome', 'score', 'summary', 'next_step'],
      additionalProperties: false,
    },
    strict: true,
  },
]

const OUTCOME_STATUS: Record<string, string> = {
  ready_to_order: 'ready_to_order',
  qualified_prospect: 'qualified',
  nurture: 'nurture',
  not_a_fit: 'lost',
}

// ---------- knowledge base (served from the site itself, cached per instance) ----------
let kbCache: { text: string; at: number } | null = null
async function knowledgeBase(origin: string) {
  if (kbCache && Date.now() - kbCache.at < 10 * 60 * 1000) return kbCache.text
  try {
    const r = await fetch(new URL('/knowledge/peroxcity-kb.md', origin))
    if (r.ok) {
      kbCache = { text: (await r.text()).slice(0, 60000), at: Date.now() }
      return kbCache.text
    }
  } catch {}
  return kbCache?.text || 'Products: Concentrate Kit $99 (1), $89 each (2), $79 each (3+). Ready-To-Use 7%: 1 gal $29, 5 gal $129. Drums and totes by quote. Free shipping over $1,000 on kits and RTU. Ships to the lower 48 only. Phone 1-888-253-6962.'
}

function instructions() {
  return `You are the voice sales agent on PeroXcity's contractor line. PeroXcity is a super boosted hydrogen peroxide cleaner made and shipped by Sealer Life in Fort Myers, Florida. Callers are mostly contractors: soft wash and pressure washing companies, roofers, property maintenance, commercial kitchen and marine cleaners. You are on a live voice call; everything you write is spoken aloud.

Your job on every call:
1. Greet them, get their name and company, and find out what they need.
2. Early on, ask plainly whether they are ready to place an order today or still looking into it.
3. READY TO ORDER: confirm products and quantities (quote kit tier pricing: $99 for one, $89 each for two, $79 each for three or more; a box holds three), then collect phone, email and a lower-48 ship-to address. Read the order and total back, then call create_order. Tell them someone from the team will text and email a secure checkout link shortly, and their order ships UPS Ground from Fort Myers once paid. Never ask for or accept card numbers. Drums, totes or fleet pricing: use request_followup for a quote.
4. NOT READY: qualify them as a prospect, conversationally, one question at a time: what kind of work they do, where, how many crews or rigs, what they use now and roughly how much per month, main surfaces, who makes the buying decision, and their timeline. Answer their questions as you go. Offer a sensible next step: a single kit to test, a callback from the team, or info by email (request_followup).
5. Save what you learn with update_lead as soon as you learn it, not only at the end. The sales team works from this record.
6. Before saying goodbye, call finish_call with an honest outcome, score (hot: ready now or within days; warm: real need, weeks out; cold: browsing or poor fit) and a next step.

How to talk:
- Short, friendly, job-site practical. One or two sentences, then one question. No lists, markdown or emoji.
- Say prices the way a person would. Read phone numbers and emails back once to confirm.
- Never invent prices, specs or policies that are not in the knowledge base. If unsure, offer a callback from the team.
- Follow the knowledge base's rules on bleach tone and on claims exactly. In particular PeroXcity removes mold and mildew STAINS; it is a cleaner, not a disinfectant or pesticide. Never say it kills anything.
- If someone is in a medical emergency, tell them to call Poison Control at 1-800-222-1222 or 911.

If there are no earlier messages, answer the phone: "Thanks for calling PeroXcity, ..." and ask how you can help.`
}

let fallbacksSupported = true
async function callClaude(params: any) {
  if (fallbacksSupported) {
    try {
      return await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any)
    } catch (err) {
      if (!(err instanceof Anthropic.BadRequestError)) throw err
      fallbacksSupported = false
    }
  }
  return client.messages.create(params)
}

type CallState = { id: string; leadId: number | null; ownsLead: boolean }

async function runTool(name: string, input: any, call: CallState) {
  const ensureLead = async (fields: Record<string, string> = {}) => {
    call.leadId = await upsertLead({ leadId: call.leadId, ownsLead: call.ownsLead, fields, source: 'voice', author: AGENT })
    if (call.leadId) {
      const [l] = await db.select({ createdAt: leads.createdAt }).from(leads).where(eq(leads.id, call.leadId))
      const [c] = await db.select({ createdAt: calls.createdAt }).from(calls).where(eq(calls.id, call.id))
      call.ownsLead = !!(l && c && l.createdAt >= c.createdAt)
      await db.update(calls).set({ leadId: call.leadId, updatedAt: new Date() }).where(eq(calls.id, call.id))
    }
    return call.leadId!
  }

  switch (name) {
    case 'update_lead': {
      const fields = pickLeadFields(input)
      if (!Object.keys(fields).length && !call.leadId) return { saved: false, note: 'Nothing to save yet.' }
      const id = await ensureLead(fields)
      return { saved: true, lead_id: id, fields_saved: Object.keys(fields) }
    }
    case 'create_order': {
      const { items, subtotal, freeShipping } = priceItems(input.items)
      if (!items.length) return { error: 'No valid items. Products are concentrate_kit, rtu_1gal, rtu_5gal with quantity 1 or more.' }
      const state = clip(input.state, 2).toUpperCase()
      if (NOT_LOWER_48.has(state) || state.length !== 2)
        return { error: 'We only ship to the lower 48 states. Offer a callback with request_followup if they need another option.' }
      const leadId = await ensureLead({})
      const [lead] = await db.select().from(leads).where(eq(leads.id, leadId))
      const missing = ['name', 'phone', 'email'].filter((k) => !(lead as any)?.[k])
      if (missing.length) return { error: `Save the caller's ${missing.join(', ')} with update_lead first.` }
      const shipTo = {
        name: clip(input.ship_to_name, 120),
        street: clip(input.street, 200),
        city: clip(input.city, 100),
        state,
        zip: clip(input.zip, 10),
      }
      const [order] = await db
        .insert(orders)
        .values({ leadId, items, subtotalCents: subtotal, freeShipping, shipTo, notes: opt(input.notes, 1000), createdBy: AGENT })
        .returning({ id: orders.id })
      const lines = items.map((i) => `${i.quantity} × ${i.label} @ ${dollars(i.unit_cents)}`).join('; ')
      await logActivity(leadId, AGENT, 'order', `Order #${order.id} requested: ${lines}. Subtotal ${dollars(subtotal)}${freeShipping ? ' (free shipping)' : ' + UPS Ground shipping'}. Ship to ${shipTo.name}, ${shipTo.street}, ${shipTo.city} ${shipTo.state} ${shipTo.zip}. Needs a checkout link.`)
      await setStatus(leadId, 'ready_to_order', AGENT)
      await db.update(leads).set({ score: 'hot', nextStep: `Send checkout link for order #${order.id}`, updatedAt: new Date() }).where(eq(leads.id, leadId))
      return {
        order_number: order.id,
        items: items.map((i) => ({ item: i.label, quantity: i.quantity, each: dollars(i.unit_cents), line: dollars(i.line_cents) })),
        subtotal: dollars(subtotal),
        shipping: freeShipping ? 'free (order over $1,000)' : 'UPS Ground, calculated at checkout',
        next: 'The team texts and emails a secure checkout link. Ships from Fort Myers once paid.',
      }
    }
    case 'request_followup': {
      const leadId = await ensureLead({})
      const when = opt(input.best_time, 120)
      const body = `Follow-up (${input.urgency}, by ${input.channel}${when ? ', ' + when : ''}): ${clip(input.reason, 1000)}`
      await logActivity(leadId, AGENT, 'followup', body)
      const days = input.urgency === 'today' ? 0 : input.urgency === 'this_week' ? 2 : 14
      const followUpAt = new Date(Date.now() + days * 86400000)
      await db.update(leads).set({ nextStep: clip(input.reason, 300), followUpAt, updatedAt: new Date() }).where(eq(leads.id, leadId))
      return { queued: true, for_team: 'PeroXcity sales team', urgency: input.urgency }
    }
    case 'finish_call': {
      const summary = clip(input.summary, 2000)
      await db.update(calls).set({ outcome: input.outcome, summary, updatedAt: new Date() }).where(eq(calls.id, call.id))
      if (!call.leadId) return { closed: true, note: 'No lead was saved for this caller.' }
      await logActivity(call.leadId, AGENT, 'call', `Call summary (${input.outcome}, ${input.score}): ${summary} Next step: ${clip(input.next_step, 300)}`)
      const status = OUTCOME_STATUS[input.outcome]
      if (status) await setStatus(call.leadId, status, AGENT)
      const [lead] = await db.select({ nextStep: leads.nextStep, status: leads.status }).from(leads).where(eq(leads.id, call.leadId))
      await db
        .update(leads)
        .set({
          score: input.score,
          summary,
          // Keep an order's checkout task as the next step.
          nextStep: lead?.status === 'ready_to_order' && lead.nextStep ? lead.nextStep : clip(input.next_step, 300),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, call.leadId))
      return { closed: true }
    }
  }
  return { error: 'unknown tool' }
}

async function loadCall(id: unknown): Promise<CallState | null> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const [c] = await db.select().from(calls).where(eq(calls.id, id))
  if (!c || Date.now() - c.createdAt.getTime() > CALL_TTL_MS) return null
  let ownsLead = false
  if (c.leadId) {
    const [l] = await db.select({ createdAt: leads.createdAt }).from(leads).where(eq(leads.id, c.leadId))
    ownsLead = !!(l && l.createdAt >= c.createdAt)
  }
  return { id: c.id, leadId: c.leadId, ownsLead }
}

async function appendTranscript(callId: string, entries: { role: string; text: string }[]) {
  const [c] = await db.select({ transcript: calls.transcript }).from(calls).where(eq(calls.id, callId))
  const at = new Date().toISOString()
  const t = [...((c?.transcript as any[]) || []), ...entries.map((e) => ({ ...e, at }))].slice(-400)
  await db.update(calls).set({ transcript: t, updatedAt: new Date() }).where(eq(calls.id, callId))
}

export async function voiceTurn(req: Request) {
  const body = await readJson(req)
  if (!body) return json({ error: 'Invalid JSON' }, 400)

  let call = body.callId ? await loadCall(body.callId) : null
  if (body.callId && !call) return json({ error: 'This call has expired. Start a new call.' }, 410)
  const history = call && Array.isArray(body.messages) ? body.messages.filter((m: any) => m && (m.role === 'user' || m.role === 'assistant')) : []
  if (JSON.stringify(history).length > MAX_HISTORY_BYTES) return json({ error: 'Call is too long. Start a new call.' }, 413)
  if (!call) {
    const [c] = await db.insert(calls).values({}).returning({ id: calls.id })
    call = { id: c.id, leadId: null, ownsLead: false }
  }

  const said = clip(body.text, 1000)
  const kb = await knowledgeBase(new URL(req.url).origin)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
  const system: any[] = [
    { type: 'text', text: instructions() + '\n\n<knowledge_base>\n' + kb + '\n</knowledge_base>', cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `Today is ${today} (Eastern time).` },
  ]

  // Append-only conversation, replayed exactly as the API returned it.
  const messages: any[] = [...history, { role: 'user', content: said || '(The phone rings. Answer it.)' }]
  const actions: any[] = []
  let reply = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res: any = await callClaude({ model: MODEL, max_tokens: 4000, system, tools: TOOLS, output_config: { effort: 'low' }, messages })
    messages.push({ role: 'assistant', content: res.content })
    const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim()
    if (text) reply = text
    if (res.stop_reason === 'refusal') {
      reply = "Sorry, I can't help with that one. I can have someone from our team call you back."
      break
    }
    if (res.stop_reason !== 'tool_use') break

    const results: any[] = []
    for (const b of res.content.filter((x: any) => x.type === 'tool_use')) {
      let result: any
      try {
        result = await runTool(b.name, b.input || {}, call)
      } catch (err) {
        console.error('tool error', b.name, err)
        result = { error: 'The CRM did not save that. Apologize briefly and offer a callback.' }
      }
      actions.push({ tool: b.name, input: b.input, result })
      results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(result), ...(result?.error ? { is_error: true } : {}) })
    }
    messages.push({ role: 'user', content: results })
  }

  if (!reply) reply = 'Sorry, could you say that again?'
  await appendTranscript(call.id, [
    ...(said ? [{ role: 'caller', text: said }] : []),
    ...actions.map((a) => ({ role: 'action', text: a.tool + (a.result?.error ? ' (failed)' : '') })),
    { role: 'agent', text: reply },
  ])
  return json({ callId: call.id, leadId: call.leadId, reply, actions, messages })
}

// Caller hung up. If the agent never closed the call out, summarize it for the team.
export async function endCall(req: Request) {
  const body = await readJson(req)
  const call = await loadCall(body?.callId)
  if (!call) return json({ ok: true })
  const [c] = await db.select().from(calls).where(eq(calls.id, call.id))
  if (!c || c.summary || !call.leadId) return json({ ok: true })
  const transcript = ((c.transcript as any[]) || []).filter((e) => e.role !== 'action').map((e) => `${e.role}: ${e.text}`).join('\n')
  if (!transcript.trim()) return json({ ok: true })
  try {
    const res: any = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              score: { type: 'string', enum: ['hot', 'warm', 'cold'] },
              next_step: { type: 'string' },
            },
            required: ['summary', 'score', 'next_step'],
            additionalProperties: false,
          },
        },
      },
      system: 'You summarize sales calls for the PeroXcity sales team. The caller hung up before the agent closed the call. Write a 2-4 sentence summary, a lead score (hot: ready now; warm: real need, weeks out; cold: browsing or poor fit), and the single next step for a human.',
      messages: [{ role: 'user', content: transcript.slice(0, 50000) }],
    } as any)
    const text = res.content.find((b: any) => b.type === 'text')?.text
    const out = text ? JSON.parse(text) : null
    if (out) {
      await db.update(calls).set({ summary: clip(out.summary, 2000), outcome: 'hung_up', updatedAt: new Date() }).where(eq(calls.id, call.id))
      await logActivity(call.leadId, AGENT, 'call', `Call ended by caller (${out.score}): ${clip(out.summary, 2000)} Next step: ${clip(out.next_step, 300)}`)
      const score = ['hot', 'warm', 'cold'].includes(out.score) ? out.score : null
      const [lead] = await db.select({ status: leads.status }).from(leads).where(eq(leads.id, call.leadId))
      await db
        .update(leads)
        .set({
          summary: clip(out.summary, 2000),
          score,
          ...(lead?.status === 'ready_to_order' ? {} : { nextStep: clip(out.next_step, 300) }),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, call.leadId))
      if (lead?.status === 'new') await setStatus(call.leadId, score === 'cold' ? 'nurture' : 'qualified', AGENT)
    }
  } catch (err) {
    console.error('summary error', err)
    await logActivity(call.leadId, AGENT, 'call', 'Call ended by caller. See the call transcript.')
  }
  return json({ ok: true })
}
