// netlify/functions/approve-deposit.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Use POST' }) };
    }

    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: 'DATABASE_URL not set' }) };
    const sql = neon(dbUrl);

    const { id } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: 'Missing id' }) };

    const now = new Date().toISOString();

    // flip tx → completed and credit balance (coin normalized to UPPERCASE)
    const res = await sql`
      WITH upd AS (
        UPDATE transactions
           SET status = 'completed', updated_at = ${now}
         WHERE id = ${id}::uuid
           AND type = 'deposit'
           AND status = 'pending'
         RETURNING user_id, UPPER(coin_symbol) AS coin_symbol, amount
      ),
      upsert AS (
        INSERT INTO user_balances (user_id, coin_symbol, balance, locked_balance, created_at, updated_at)
        SELECT u.user_id, u.coin_symbol, u.amount, 0, ${now}, ${now}
          FROM upd u
        ON CONFLICT (user_id, coin_symbol)
        DO UPDATE SET
          balance    = user_balances.balance + EXCLUDED.balance,
          updated_at = ${now}
        RETURNING 1
      )
      SELECT (SELECT COUNT(*) FROM upd) AS changed;
    `;

    const changed = Number((res as any)[0]?.changed || 0);
    if (changed === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ ok: false, message: 'Not found or not pending' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('approve-deposit', e);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: String(e?.message || e) }) };
  }
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};
