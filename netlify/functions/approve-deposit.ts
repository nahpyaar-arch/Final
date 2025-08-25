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

    // 1 CTE to flip tx -> completed and credit balance (case-insensitive coin)
    const res = await sql`
      WITH upd AS (
        UPDATE transactions
           SET status = 'completed', updated_at = ${now}
         WHERE id = ${id}::uuid
           AND type = 'deposit'
           AND status = 'pending'
         RETURNING user_id, coin_symbol, amount
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
    if (changed === 0) return { statusCode: 404, body: 'Not found or not pending' };

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('approve-deposit', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
