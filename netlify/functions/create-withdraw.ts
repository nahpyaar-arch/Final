import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

const toNum = (v: any) => (typeof v === 'string' ? Number(v) : v);

// Read from both POST body and query; accept common aliases
function getInput(event: any) {
  const qs = new URLSearchParams(event.rawQuery || '');
  let body: any = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (body?.[k] !== undefined && body?.[k] !== '') return body[k];
      const qv = qs.get(k);
      if (qv !== null) return qv;
    }
    return undefined;
  };

  const user_id     = pick('user_id','userId','uid');
  const coin_symbol = pick('coin_symbol','coin','symbol');
  const amount      = toNum(pick('amount','value','qty'));
  const address     = pick('to_address','address','toAddress','dest');
  const network     = pick('network','chain','net');

  return { user_id, coin_symbol, amount, address, network };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok:false, error:'Use POST' }) };
  }

  try {
    const { user_id, coin_symbol, amount, address, network } = getInput(event);

    if (!user_id)     return { statusCode:400, headers, body: JSON.stringify({ ok:false, error:'Missing user_id' }) };
    if (!coin_symbol) return { statusCode:400, headers, body: JSON.stringify({ ok:false, error:'Missing coin_symbol' }) };
    if (!amount || Number.isNaN(amount) || amount <= 0)
                      return { statusCode:400, headers, body: JSON.stringify({ ok:false, error:'Invalid amount' }) };
    if (!address || !network)
                      return { statusCode:400, headers, body: JSON.stringify({ ok:false, error:'Address and network required' }) };

    const dbUrl =
      process.env.DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      process.env.VITE_DATABASE_URL;
    if (!dbUrl) {
      return { statusCode:500, headers, body: JSON.stringify({ ok:false, error:'DATABASE_URL not set' }) };
    }

    const sql = neon(dbUrl);

    // 1) balance check
    const balRows = await sql`
      SELECT balance
      FROM assets
      WHERE user_id = ${user_id} AND coin_symbol = ${coin_symbol}
    `;
    const balance = Number(balRows[0]?.balance ?? 0);
    if (balance < amount) {
      return { statusCode:400, headers, body: JSON.stringify({ ok:false, error:'Insufficient balance' }) };
    }

    // 2) insert pending withdrawal and return id
    // If your transactions table doesn't have a "network" column,
    // replace this INSERT with the commented version below.
    const rows = await sql`
      INSERT INTO transactions
        (user_id, type, coin_symbol, amount, status, to_address, network)
      VALUES
        (${user_id}, 'withdraw', ${coin_symbol}, ${amount}, 'pending', ${address}, ${network})
      RETURNING id
    `;

    // ── If "network" column doesn't exist, use:
    // const rows = await sql`
    //   INSERT INTO transactions
    //     (user_id, type, coin_symbol, amount, status, to_address)
    //   VALUES
    //     (${user_id}, 'withdraw', ${coin_symbol}, ${amount}, 'pending', ${address})
    //   RETURNING id
    // `;

    return { statusCode:200, headers, body: JSON.stringify({ ok:true, id: rows[0]?.id }) };
  } catch (e: any) {
    return { statusCode:500, headers, body: JSON.stringify({ ok:false, error: e?.message || 'Server error' }) };
  }
};
