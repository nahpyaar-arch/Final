// netlify/functions/approve-deposit.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

type RowUserId = { user_id: string };
type AssetRow = { symbol: string; balance: string; price: string; value_usd: string };

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Use POST' };
    }

    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, body: 'DATABASE_URL not set' };
    const sql = neon(dbUrl);

    const { id: txId } = JSON.parse(event.body || '{}');
    if (!txId) return { statusCode: 400, body: 'Missing id' };

    // 1) Approve + credit in ONE atomic SQL statement (no .begin() needed)
    const updRes = await sql`
      WITH upd AS (
        UPDATE transactions
           SET status = 'completed', updated_at = NOW()
         WHERE id = ${txId}::uuid
           AND type = 'deposit'
           AND status = 'pending'
       RETURNING user_id, coin_symbol, amount
      )
      INSERT INTO user_balances (user_id, coin_symbol, balance)
      SELECT user_id, coin_symbol, amount FROM upd
      ON CONFLICT (user_id, coin_symbol)
      DO UPDATE SET
        balance    = user_balances.balance + EXCLUDED.balance,
        updated_at = NOW()
      RETURNING (SELECT user_id FROM upd LIMIT 1) AS user_id;
    `;

    // Cast rows (Neon’s template has no generics)
    const upd = updRes as unknown as RowUserId[];

    // If nothing returned, maybe it was already completed — look up user_id anyway
    let userId = upd[0]?.user_id;
    if (!userId) {
      const q = (await sql`
        SELECT user_id FROM transactions WHERE id = ${txId}::uuid
      `) as unknown as RowUserId[];
      userId = q[0]?.user_id;
    }

    if (!userId) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ok: true, already: true }),
      };
    }

    // 2) Fetch refreshed assets
    const assetsRes = await sql`
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
    `;
    const assets = assetsRes as unknown as AssetRow[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, already: false, user_id: userId, assets }),
    };
  } catch (e: any) {
    console.error('approve-deposit error', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
