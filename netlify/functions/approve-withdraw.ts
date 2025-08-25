// netlify/functions/approve-withdraw.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, message: 'Use POST' }),
      };
    }

    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, message: 'DATABASE_URL not set' }),
      };
    }
    const sql = neon(dbUrl);

    const { id } = JSON.parse(event.body || '{}');
    if (!id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, message: 'Missing id' }),
      };
    }

    const now = new Date().toISOString();

    // 1) fetch pending withdraw tx
    const txRows = await sql`
      SELECT user_id, coin_symbol, amount
      FROM transactions
      WHERE id = ${id}::uuid
        AND type = 'withdraw'
        AND status = 'pending'
      LIMIT 1
    `;
    if (txRows.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, message: 'Transaction not found or not pending' }),
      };
    }

    const tx = txRows[0];
    const coinSymbol = String(tx.coin_symbol).toUpperCase();
    const amount = Number(tx.amount);

    // 2) read current balances
    const balanceRows = await sql`
      SELECT balance, locked_balance
      FROM user_balances
      WHERE user_id = ${tx.user_id} AND coin_symbol = ${coinSymbol}
      LIMIT 1
    `;
    const current = balanceRows[0] || { balance: 0, locked_balance: 0 };
    const available = Number(current.balance || 0);
    const locked = Number(current.locked_balance || 0);

    // deduct from locked first, then available
    const fromLocked = Math.min(locked, amount);
    const fromAvailable = amount - fromLocked;

    if (available < fromAvailable) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, message: 'Insufficient balance' }),
      };
    }

    // 3) update balances
    await sql`
      UPDATE user_balances
      SET
        locked_balance = locked_balance - ${fromLocked},
        balance = balance - ${fromAvailable},
        updated_at = ${now}
      WHERE user_id = ${tx.user_id} AND coin_symbol = ${coinSymbol}
    `;

    // 4) mark tx completed
    await sql`
      UPDATE transactions
      SET status = 'completed', updated_at = ${now}
      WHERE id = ${id}::uuid
    `;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e: any) {
    console.error('approve-withdraw', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, message: String(e?.message || e) }),
    };
  }
};
