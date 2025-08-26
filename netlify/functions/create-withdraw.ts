// netlify/functions/create-withdraw.ts
import type { Handler } from '@netlify/functions';

// shared headers
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

const num = (v: any) => (typeof v === 'string' ? Number(v) : v);

// Extract from both body and query, accept multiple alias keys
function getInput(event: any) {
  const qs = new URLSearchParams(event.rawQuery || '');
  let body: any = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  const pick = (...keys: string[]) =>
    keys.map(k => (body?.[k] ?? (qs.get(k) ?? undefined))).find(v => v !== undefined);

  const user_id     = pick('user_id', 'userId', 'uid');
  const coin_symbol = pick('coin_symbol', 'coin', 'symbol');
  const amount      = num(pick('amount', 'value', 'qty'));
  const address     = pick('address', 'to_address', 'toAddress', 'dest');
  const network     = pick('network', 'chain', 'net');

  return { user_id, coin_symbol, amount, address, network };
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Use POST or GET' }) };
    }

    const { user_id, coin_symbol, amount, address, network } = getInput(event);

    // Helpful, explicit errors
    if (!user_id)     return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Missing user_id' }) };
    if (!coin_symbol) return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Missing coin_symbol' }) };
    if (!amount || Number.isNaN(amount) || amount <= 0)
                      return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Invalid amount' }) };
    if (!address || !network)
                      return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Address and network required' }) };

    // ── TODO: YOUR EXISTING DB LOGIC HERE ─────────────────────────────
    // Example (pseudo-Neon/Supabase):
    // 1) check balance >= amount
    // 2) insert transactions row { type:'withdraw', status:'pending', to_address: address, network }
    // 3) return its id

    // Return a stub until DB call succeeds; replace with real insert result.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, id: 'stub-replace-with-inserted-id' })
    };
    // ──────────────────────────────────────────────────────────────────
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error: e?.message || 'Server error' }) };
  }
};
