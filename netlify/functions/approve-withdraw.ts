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
        SELECT ub.user_id, ub.coin_symbol, ub.balance::float AS bal, ub.locked_balance::float AS lck, t.amount::float AS amt
          FROM user_balances ub
          JOIN tx t ON ub.user_id = t.user_id
                  AND LOWER(ub.coin_symbol) = LOWER(t.coin_symbol)
         LIMIT 1
      ),
      // compute how much to take from locked and how much from balance
      compute AS (
        SELECT
          c.user_id, c.coin_symbol,
          LEAST(c.lck, c.amt)         AS take_locked,
          GREATEST(c.amt - c.lck, 0)  AS take_balance,
          (c.bal + c.lck) >= c.amt    AS enough
        FROM cur c
      ),
      apply AS (
        UPDATE user_balances ub
           SET locked_balance = ub.locked_balance - comp.take_locked,
               balance        = ub.balance        - comp.take_balance,
               updated_at     = ${now}
          FROM compute comp
         WHERE ub.user_id = comp.user_id
           AND LOWER(ub.coin_symbol) = LOWER(comp.coin_symbol)
           AND comp.enough = TRUE
         RETURNING 1
      ),
      done AS (
        UPDATE transactions
           SET status = 'completed', updated_at = ${now}
         WHERE id = ${id}::uuid
           AND EXISTS (SELECT 1 FROM apply)
         RETURNING 1
      )
      SELECT (SELECT COUNT(*) FROM done) AS ok;
    `;

    const ok = Number((res as any)[0]?.ok || 0);
    if (!ok) return { statusCode: 400, body: 'Insufficient funds or not pending' };

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('approve-withdraw', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
