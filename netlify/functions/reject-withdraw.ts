import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Use POST' };
    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, body: 'DATABASE_URL not set' };
    const sql = neon(dbUrl);

    const { id } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, body: 'Missing id' };

    const now = new Date().toISOString();

    const res = await sql`
      WITH tx AS (
        SELECT user_id, coin_symbol, amount
          FROM transactions
         WHERE id = ${id}::uuid
           AND type = 'withdraw'
           AND status = 'pending'
         LIMIT 1
      ),
      cur AS (
        SELECT ub.user_id, ub.coin_symbol, ub.locked_balance::float AS lck, t.amount::float AS amt
          FROM user_balances ub
          JOIN tx t ON ub.user_id = t.user_id
                  AND LOWER(ub.coin_symbol) = LOWER(t.coin_symbol)
         LIMIT 1
      ),
      // unlock up to the request amount
      unlock AS (
        UPDATE user_balances ub
           SET locked_balance = GREATEST(0, ub.locked_balance - LEAST(cur.lck, cur.amt)),
               updated_at     = ${now}
          FROM cur
         WHERE ub.user_id = cur.user_id
           AND LOWER(ub.coin_symbol) = LOWER(cur.coin_symbol)
         RETURNING 1
      ),
      rej AS (
        UPDATE transactions
           SET status = 'rejected', updated_at = ${now}
         WHERE id = ${id}::uuid
         RETURNING 1
      )
      SELECT (SELECT COUNT(*) FROM rej) AS ok;
    `;
    const ok = Number((res as any)[0]?.ok || 0);
    if (!ok) return { statusCode: 404, body: 'Not found or not pending' };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('reject-withdraw', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
