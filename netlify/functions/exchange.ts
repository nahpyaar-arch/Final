// netlify/functions/exchange.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

type AssetRow = { symbol: string; balance: string; price: string; value_usd: string };

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Use POST' };

    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, body: 'DATABASE_URL not set' };
    const sql = neon(dbUrl);

    const body = JSON.parse(event.body || '{}');
    const userId = String(body.user_id || '');
    const from = String(body.from_symbol || '').toUpperCase();
    const to = String(body.to_symbol || '').toUpperCase();
    const amount = Number(body.amount || 0);

    if (!userId) return { statusCode: 400, body: 'Missing user_id' };
    if (!from || !to || from === to) return { statusCode: 400, body: 'Invalid symbols' };
    if (!Number.isFinite(amount) || amount <= 0) return { statusCode: 400, body: 'Invalid amount' };

    // fetch prices
    const prices = await sql`
      SELECT symbol, price::float AS price
      FROM coins
      WHERE symbol IN (${from}, ${to})
    `;
    const priceMap: Record<string, number> = {};
    for (const row of prices as any[]) priceMap[row.symbol] = Number(row.price);

    const fromPrice = priceMap[from];
    const toPrice = priceMap[to];
    if (!fromPrice || !toPrice) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Price not available' }) };
    }

    const valueUSD = amount * fromPrice;
    const feeUSD = valueUSD * 0.001; // 0.1% fee
    const toAmount = (valueUSD - feeUSD) / toPrice;

    // 🔒 one atomic operation
    const now = new Date().toISOString();
    const res = await sql`
      WITH dec AS (
        UPDATE user_balances ub
           SET balance = ub.balance - ${amount}, updated_at = ${now}
         WHERE ub.user_id = ${userId}::uuid
           AND LOWER(ub.coin_symbol) = LOWER(${from})
           AND ub.balance >= ${amount}
         RETURNING ub.user_id
      ),
      ensure AS (
        INSERT INTO user_balances (user_id, coin_symbol, balance, locked_balance, created_at, updated_at)
        SELECT ${userId}::uuid, ${to}, 0, 0, ${now}, ${now}
        ON CONFLICT (user_id, coin_symbol) DO NOTHING
        RETURNING 1
      ),
      inc AS (
        UPDATE user_balances ub
           SET balance = ub.balance + ${toAmount}, updated_at = ${now}
          FROM dec
         WHERE ub.user_id = dec.user_id
           AND LOWER(ub.coin_symbol) = LOWER(${to})
         RETURNING ub.user_id
      ),
      ins AS (
        INSERT INTO transactions (user_id, type, coin_symbol, amount, status, details, created_at, updated_at)
        SELECT ${userId}::uuid, 'exchange', ${from}, ${amount}, 'completed',
               ${JSON.stringify({ from, to, to_amount: toAmount, fee_usd: feeUSD })}::jsonb,
               ${now}, ${now}
        FROM inc
        RETURNING id
      )
      SELECT (SELECT id FROM ins LIMIT 1) AS txid;
    `;

    const txid = (res as any)[0]?.txid;
    if (!txid) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Insufficient balance' }) };
    }

    // return refreshed balances for frontend
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
      body: JSON.stringify({ ok: true, id: txid, to_amount: toAmount, fee: feeUSD, assets }),
    };
  } catch (e: any) {
    console.error('exchange error:', e);
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e?.message || e) }) };
  }
};
