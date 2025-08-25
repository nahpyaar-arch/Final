// netlify/functions/approve-deposit.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: 'Use POST' }) };
    }

    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: 'DATABASE_URL not set' }) };
    const sql = neon(dbUrl);

    const { id } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: 'Missing id' }) };

    const now = new Date().toISOString();

    // Get transaction details first
    const txRows = await sql`
      SELECT user_id, coin_symbol, amount
      FROM transactions
      WHERE id = ${id}::uuid
        AND type = 'deposit'
        AND status = 'pending'
      LIMIT 1
    `;

    if (txRows.length === 0) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: 'Transaction not found or not pending' }) };
    }

    const tx = txRows[0];
    const coinSymbol = String(tx.coin_symbol).toUpperCase();

    // Update transaction status to completed
    await sql`
      UPDATE transactions
      SET status = 'completed', updated_at = ${now}
      WHERE id = ${id}::uuid
    `;

    // Credit user balance
    const res = await sql`
      INSERT INTO user_balances (id, user_id, coin_symbol, balance, locked_balance, created_at, updated_at)
      VALUES (${crypto.randomUUID()}, ${tx.user_id}, ${coinSymbol}, ${tx.amount}, 0, ${now}, ${now})
      ON CONFLICT (user_id, coin_symbol)
      DO UPDATE SET
        balance = user_balances.balance + ${tx.amount},
        updated_at = ${now}
      RETURNING 1
    `;

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('approve-deposit', e);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: String(e?.message || e) }) };
  }
};
