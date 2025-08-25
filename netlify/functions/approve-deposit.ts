// netlify/functions/approve-deposit.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const SYM = (x: any) => String(x || '').toUpperCase();

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: 'Use POST' }) };
    }

    const dbUrl =
      process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: 'DATABASE_URL not set' }) };
    const sql = neon(dbUrl);

    const { id } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: 'Missing id' }) };

    const now = new Date().toISOString();

    await sql`BEGIN`;
    try {
      // Lock the tx row and fetch it
      const txRows = (await sql`
        SELECT id, user_id, type, coin_symbol, amount, status
        FROM transactions
        WHERE id = ${id}
        FOR UPDATE
      `) as unknown as Array<{ id: string; user_id: string; type: string; coin_symbol: string; amount: number; status: string }>;

      const tx = txRows?.[0];
      if (!tx || tx.type !== 'deposit' || tx.status !== 'pending') {
        await sql`ROLLBACK`;
        return { statusCode: 404, headers, body: JSON.stringify({ ok: false, message: 'Not found or not pending' }) };
      }

      const sym = SYM(tx.coin_symbol);

      // ensure balance row exists
      await sql`
        INSERT INTO user_balances (user_id, coin_symbol, balance, locked_balance, created_at, updated_at)
        VALUES (${tx.user_id}, ${sym}, 0, 0, ${now}, ${now})
        ON CONFLICT (user_id, coin_symbol) DO NOTHING
      `;

      // credit balance
      await sql`
        UPDATE user_balances
        SET balance = balance + ${Number(tx.amount)}, updated_at = ${now}
        WHERE user_id = ${tx.user_id} AND UPPER(coin_symbol) = ${sym}
      `;

      // mark transaction approved (or 'completed' if you prefer)
      await sql`
        UPDATE transactions
        SET status = 'approved', updated_at = ${now}
        WHERE id = ${id}
      `;

      await sql`COMMIT`;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      await sql`ROLLBACK`;
      throw e;
    }
  } catch (e: any) {
    console.error('approve-deposit error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: String(e?.message || e) }) };
  }
};
