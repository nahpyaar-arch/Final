import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: 'Use POST' }) };
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
        AND type = 'withdraw'
        AND status = 'pending'
      LIMIT 1
    `;

    if (txRows.length === 0) {
      return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: 'Transaction not found or not pending' }) };
    }

    const tx = txRows[0];
    const coinSymbol = String(tx.coin_symbol).toUpperCase();
    const amount = Number(tx.amount);

    // Get current balance
    const balanceRows = await sql`
      SELECT balance, locked_balance
      FROM user_balances
      WHERE user_id = ${tx.user_id} AND coin_symbol = ${coinSymbol}
      LIMIT 1
    `;

    const currentBalance = balanceRows[0] || { balance: 0, locked_balance: 0 };
    const lockedBalance = Number(currentBalance.locked_balance);
    const availableBalance = Number(currentBalance.balance);

    // Deduct from locked balance first, then from available balance if needed
    const deductFromLocked = Math.min(lockedBalance, amount);
    const deductFromAvailable = amount - deductFromLocked;

    if (availableBalance < deductFromAvailable) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: 'Insufficient balance' }) };
    }

    // Update balances
    await sql`
      UPDATE user_balances
      SET 
        locked_balance = locked_balance - ${deductFromLocked},
        balance = balance - ${deductFromAvailable},
        updated_at = ${now}
      WHERE user_id = ${tx.user_id} AND coin_symbol = ${coinSymbol}
    `;

    // Update transaction status
    const res = await sql`
      UPDATE transactions
      SET status = 'completed', updated_at = ${now}
      WHERE id = ${id}::uuid
      RETURNING 1
    `;

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('approve-withdraw', e);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: String(e?.message || e) }) };
  }
};
