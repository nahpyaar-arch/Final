// netlify/functions/approve-withdraw.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

type RowUser = { user_id: string; completed: boolean };
type AssetRow = { symbol: string; balance: string; price: string; value_usd: string };

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Use POST' };

    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, body: 'DATABASE_URL not set' };
    const sql = neon(dbUrl);

    const { id: txId } = JSON.parse(event.body || '{}');
    if (!txId) return { statusCode: 400, body: 'Missing id' };

    // one atomic statement: verify pending tx, ensure wallet row, try debit,
    // and mark transaction completed only if debit succeeded
    const res = (await sql`
      WITH w AS (
        SELECT user_id, coin_symbol, amount
        FROM transactions
        WHERE id = ${txId}::uuid
          AND type = 'withdraw'
          AND status = 'pending'
      ),
      ensure_wallet AS (
        INSERT INTO user_balances (user_id, coin_symbol, balance, locked_balance)
        SELECT user_id, coin_symbol, 0, 0 FROM w
        ON CONFLICT (user_id, coin_symbol) DO NOTHING
        RETURNING 1
      ),
      debit_locked AS (
        UPDATE user_balances ub
           SET locked_balance = ub.locked_balance - w.amount,
               updated_at     = NOW()
          FROM w
         WHERE ub.user_id = w.user_id
           AND LOWER(ub.coin_symbol) = LOWER(w.coin_symbol)
           AND ub.locked_balance >= w.amount
       RETURNING ub.user_id
      ),
      debit_main AS (
        UPDATE user_balances ub
           SET balance   = ub.balance - w.amount,
               updated_at = NOW()
          FROM w
         WHERE ub.user_id = w.user_id
           AND LOWER(ub.coin_symbol) = LOWER(w.coin_symbol)
           AND ub.locked_balance < w.amount      -- only if not handled by locked
           AND ub.balance >= w.amount
       RETURNING ub.user_id
      ),
      mark AS (
        UPDATE transactions t
           SET status = 'completed', updated_at = NOW()
          FROM w
         WHERE t.id = ${txId}::uuid
           AND (
             EXISTS (SELECT 1 FROM debit_locked)
             OR EXISTS (SELECT 1 FROM debit_main)
           )
       RETURNING t.id
      )
      SELECT
        (SELECT user_id FROM w LIMIT 1)                AS user_id,
        EXISTS(SELECT 1 FROM mark)                     AS completed;
    `) as unknown as RowUser[];

    const userId = res[0]?.user_id;
    const completed = !!res[0]?.completed;

    if (!userId) {
      // no such pending withdraw
      return { statusCode: 404, body: 'Not found or not pending' };
    }
    if (!completed) {
      // funds weren’t enough in either locked or main balance
      return { statusCode: 409, body: 'Insufficient funds' };
    }

    // return refreshed assets so UI updates immediately
    const assets = (await sql`
      SELECT
        c.symbol,
        COALESCE(ub.balance, 0)                        AS balance,
        COALESCE(c.price, 0)                           AS price,
        COALESCE(ub.balance, 0) * COALESCE(c.price, 0) AS value_usd
      FROM coins c
      LEFT JOIN user_balances ub
        ON ub.user_id = ${userId}::uuid
       AND LOWER(ub.coin_symbol) = LOWER(c.symbol)
      ORDER BY c.symbol
    `) as unknown as AssetRow[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, user_id: userId, assets }),
    };
  } catch (e: any) {
    console.error('approve-withdraw error', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
