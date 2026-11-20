// PeroXcity server: AI voice sales agent + shared team CRM.
import Anthropic from '@anthropic-ai/sdk'
import { json, readJson } from './lib/util.ts'
import { voiceTurn, endCall } from './lib/agent.ts'
import { crm } from './lib/crm.ts'
import { pickLeadFields, upsertLead, logActivity } from './lib/leads.ts'
import { opt } from './lib/util.ts'

export const config = { path: '/api/*' }

// Public "call me back" form on the landing page → a CRM lead.
async function callbackForm(req: Request) {
  const body = await readJson(req)
  if (!body) return json({ error: 'Invalid JSON' }, 400)
  if (opt(body.website)) return json({ ok: true }) // honeypot
  const fields = pickLeadFields(body)
  if (!fields.name || !fields.phone) return json({ error: 'Name and phone are required.' }, 400)
  const id = await upsertLead({ leadId: null, ownsLead: false, fields, source: 'form', author: 'Web form' })
  const note = opt(body.message, 2000)
  await logActivity(id, 'Web form', 'form', `Callback requested from the voice page.${note ? ' Message: ' + note : ''}`)
  return json({ ok: true }, 201)
}

export default async (req: Request) => {
  const { pathname } = new URL(req.url)
  try {
    if (pathname === '/api/voice-agent' && req.method === 'POST') return await voiceTurn(req)
    if (pathname === '/api/voice-agent/end' && req.method === 'POST') return await endCall(req)
    if (pathname === '/api/callback' && req.method === 'POST') return await callbackForm(req)
    if (pathname.startsWith('/api/crm')) return await crm(req, pathname)
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    console.error('api error', pathname, err)
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'The line is busy. Try again in a moment.' }, 429)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
}
