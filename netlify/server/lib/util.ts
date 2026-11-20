export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

// Returns a trimmed string, or null when empty.
export const opt = (v: unknown, n = 500) => {
  if (v === null || v === undefined) return null
  const s = clip(v, n)
  return s ? s : null
}

export const digits = (phone: unknown) => {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (!d) return null
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d
}

export async function readJson(req: Request): Promise<any> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

// ---------- catalog (matches the PeroXcity price sheet) ----------
export const PRODUCTS: Record<string, { label: string; unit: (qty: number) => number }> = {
  concentrate_kit: { label: 'Concentrate Kit (Part A + Part B)', unit: (q) => (q >= 3 ? 7900 : q === 2 ? 8900 : 9900) },
  rtu_1gal: { label: 'Ready-To-Use 7% — 1 gallon', unit: () => 2900 },
  rtu_5gal: { label: 'Ready-To-Use 7% — 5 gallon', unit: () => 12900 },
}

export const NOT_LOWER_48 = new Set(['AK', 'HI', 'PR', 'GU', 'VI', 'AS', 'MP'])

export function priceItems(raw: any[]) {
  const items: { product: string; label: string; quantity: number; unit_cents: number; line_cents: number }[] = []
  for (const r of Array.isArray(raw) ? raw : []) {
    const p = PRODUCTS[r?.product]
    const qty = Math.floor(Number(r?.quantity))
    if (!p || !Number.isFinite(qty) || qty < 1 || qty > 500) continue
    const unit = p.unit(qty)
    items.push({ product: r.product, label: p.label, quantity: qty, unit_cents: unit, line_cents: unit * qty })
  }
  const subtotal = items.reduce((s, i) => s + i.line_cents, 0)
  return { items, subtotal, freeShipping: subtotal > 100000 }
}

export const dollars = (cents: number) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
