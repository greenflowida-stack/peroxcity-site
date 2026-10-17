// PeroXcity Mix — property lookup backend (Netlify Function)
//
// GET /property?ping=1              → { ok, configured, regrid }
// GET /property?address=<street>    → { address, source, parcel, roof }
//
// Keys live in Netlify environment variables, never in the app:
//   GOOGLE_MAPS_KEY  (required)  Geocoding API + Solar API
//   REGRID_TOKEN     (optional)  parcel record; leave unset to run without it

const SQFT_PER_M2 = 10.7639;

export const config = { path: '/property' };

export default async (req) => {
  const url = new URL(req.url);
  const key = process.env.GOOGLE_MAPS_KEY || '';
  const regridToken = process.env.REGRID_TOKEN || '';

  if (url.searchParams.get('ping')) {
    return json({ ok: true, configured: !!key, regrid: !!regridToken });
  }
  const address = (url.searchParams.get('address') || '').trim();
  if (!address) return json({ error: 'address is required' }, 400);
  if (!key) return json({ error: 'not configured — set GOOGLE_MAPS_KEY in Netlify' }, 503);

  try {
    const geo = await geocode(address, key);
    const [roof, parcel] = await Promise.all([
      solarRoof(geo.lat, geo.lng, key).catch((e) => { if (/key|enabled|billing|denied|used/i.test(e.message)) throw e; return null; }),
      regridToken ? regridParcel(geo.formatted, regridToken).catch(() => null) : Promise.resolve(null),
    ]);
    const footprint = roof || await osmFootprint(geo.lat, geo.lng).catch(() => null);

    const sources = [];
    if (roof) sources.push('Google Solar imagery');
    else if (footprint) sources.push('OpenStreetMap building outline');
    sources.push(parcel ? 'Regrid parcel record' : 'Google geocoding');

    return json({
      address: geo.formatted,
      source: sources.join(' + '),
      parcel: {
        ...(parcel || {}),
        county: (parcel && parcel.county) || geo.county || undefined,
        state: (parcel && parcel.state) || geo.state || undefined,
      },
      roof: footprint,
    });
  } catch (e) {
    return json({ error: friendly(e.message || String(e)) }, 502);
  }
};

// ── Google Geocoding ─────────────────────────────────────────────
async function geocode(address, key) {
  const r = await fetch('https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + key);
  const d = await r.json();
  if (d.status === 'REQUEST_DENIED') throw new Error(d.error_message || 'request denied');
  if (d.status !== 'OK' || !d.results || !d.results.length) throw new Error('address not found');
  const res = d.results[0];
  const comp = (type) => { const c = (res.address_components || []).find(x => x.types.includes(type)); return c ? c.short_name : undefined; };
  return {
    lat: res.geometry.location.lat, lng: res.geometry.location.lng,
    formatted: res.formatted_address,
    county: (comp('administrative_area_level_2') || '').replace(/ County$/, '') || undefined,
    state: comp('administrative_area_level_1'),
  };
}

// ── Google Solar: roof segments → footprint, pitch, roof area ────
async function solarRoof(lat, lng, key) {
  const r = await fetch('https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=' + lat + '&location.longitude=' + lng + '&requiredQuality=LOW&key=' + key);
  const d = await r.json();
  if (!r.ok || d.error) {
    const msg = (d.error && d.error.message) || ('solar ' + r.status);
    if (r.status === 404) return null; // no building / no imagery here
    throw new Error(msg);
  }
  const sp = d.solarPotential || {};
  const whole = sp.wholeRoofStats || {};
  const segs = sp.roofSegmentStats || [];
  if (!whole.groundAreaMeters2) return null;
  // Area-weighted average pitch, expressed as rise-per-12
  let num = 0, den = 0;
  for (const s of segs) { const a = (s.stats && s.stats.areaMeters2) || 0; num += (s.pitchDegrees || 0) * a; den += a; }
  const deg = den ? num / den : 0;
  const pitch = Math.max(0, Math.min(18, Math.round(Math.tan(deg * Math.PI / 180) * 12)));
  const im = d.imageryDate;
  return {
    footprintSqft: Math.round(whole.groundAreaMeters2 * SQFT_PER_M2),
    roofSqft: Math.round((whole.areaMeters2 || whole.groundAreaMeters2) * SQFT_PER_M2),
    pitch, segments: segs.length,
    imageryDate: im ? im.year + '-' + String(im.month).padStart(2, '0') + '-' + String(im.day).padStart(2, '0') : undefined,
    imageryQuality: d.imageryQuality,
    source: 'Google Solar',
  };
}

// ── OpenStreetMap fallback: nearest building outline → footprint ─
async function osmFootprint(lat, lng) {
  const q = '[out:json][timeout:10];way(around:40,' + lat + ',' + lng + ')["building"];out geom;';
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  const d = await r.json();
  const ways = (d.elements || []).filter(w => w.geometry && w.geometry.length > 3);
  if (!ways.length) return null;
  // Pick the building whose centroid is closest to the geocoded point
  const best = ways.map(w => {
    const c = w.geometry.reduce((a, p) => ({ lat: a.lat + p.lat / w.geometry.length, lon: a.lon + p.lon / w.geometry.length }), { lat: 0, lon: 0 });
    return { w, dist: Math.hypot((c.lat - lat) * 111320, (c.lon - lng) * 111320 * Math.cos(lat * Math.PI / 180)) };
  }).sort((a, b) => a.dist - b.dist)[0].w;
  const m2 = polygonAreaM2(best.geometry, lat);
  if (!m2) return null;
  return { footprintSqft: Math.round(m2 * SQFT_PER_M2), roofSqft: undefined, pitch: undefined, segments: 0, source: 'OpenStreetMap' };
}

function polygonAreaM2(pts, lat0) {
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 111320;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += (p.lon * kx) * (q.lat * ky) - (q.lon * kx) * (p.lat * ky);
  }
  return Math.abs(a) / 2;
}

// ── Regrid (optional): parcel record ─────────────────────────────
async function regridParcel(address, token) {
  const r = await fetch('https://app.regrid.com/api/v2/parcels/address?query=' + encodeURIComponent(address) + '&limit=1&token=' + token);
  const d = await r.json();
  const f = d && d.parcels && d.parcels.features && d.parcels.features[0];
  if (!f) return null;
  const p = (f.properties && f.properties.fields) || {};
  return {
    apn: p.parcelnumb || undefined,
    yearBuilt: p.yearbuilt || undefined,
    stories: p.numstories || undefined,
    buildingSqft: p.ll_bldg_footprint_sqft || undefined,
    lotSqft: p.ll_gissqft || undefined,
    county: p.county || undefined,
    state: p.state2 || undefined,
    owner: undefined, // intentionally not returned to the app
  };
}

function friendly(msg) {
  const m = msg.toLowerCase();
  if (m.includes('api key not valid') || m.includes('invalid')) return 'key not valid — check the key and its API restrictions in Google Cloud';
  if (m.includes('not enabled') || m.includes('has not been used')) return 'API not enabled — enable Solar API and Geocoding API in Google Cloud';
  if (m.includes('billing')) return 'billing — link a card to the Google Cloud project';
  return msg;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
