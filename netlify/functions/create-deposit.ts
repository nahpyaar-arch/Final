// netlify/functions/create-deposit.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const SYM = (x: any) => String(x || '').toUpperCase();

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Use POST' }) };
    }

    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: 'DATABASE_URL not set' }) };
    const sql = neon(dbUrl);

    let body: any = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}

    const user_id = String(body.user_id || '');
    const coin_symbol = SYM(body.coin_symbol);
    const amount = Number(body.amount);
    const details = body.details ?? {};

    if (!user_id) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: 'Missing user_id' }) };
    if (!coin_symbol) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: 'Missing coin_symbol' }) };
    if (!Number.isFinite(amount) || amount <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: 'Invalid amount' }) };
    }

    const id = crypto.randomUUID();
    await sql`
      INSERT INTO transactions (id, user_id, type, coin_symbol, amount, status, details, created_at, updated_at)
      VALUES (${id}, ${user_id}, 'deposit', ${coin_symbol}, ${amount}, 'pending',
              ${JSON.stringify(details || {})}::jsonb, NOW(), NOW())
    `;

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id }) };
  } catch (e: any) {
    console.error('create-deposit error', e);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: String(e?.message || e) }) };
  }
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};
