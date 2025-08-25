// netlify/functions/exchange.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const SYM = (x: any) => String(x || '').toUpperCase();

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return bad('Use POST', 405);
    }

    const dbUrl =
      process.env.DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      process.env.VITE_DATABASE_URL;
    if (!dbUrl) return bad('DATABASE_URL / NEON_DATABASE_URL not set', 500);

    const sql = neon(dbUrl);

    // ── parse & validate
    let payload: any = {};
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return bad('Invalid JSON body', 400);
    }

    const user_id = String(payload.user_id || '');
    const FROM = SYM(payload.from_symbol);
    const TO = SYM(payload.to_symbol);
    const amount = Number(payload.amount);

    if (!user_id) return bad('Missing user_id', 400);
    if (!FROM) return bad('Missing from_symbol', 400);
    if (!TO) return bad('Missing to_symbol', 400);
    if (FROM === TO) return bad('from_symbol and to_symbol must differ', 400);
    if (!Number.isFinite(amount) || amount <= 0) return bad('Invalid amount', 400);

    // ── prices (case-insensitive) — no TS generics on sql; cast result instead
    const priceRows = (await sql`
      SELECT UPPER(symbol) AS symbol, price::float AS price
      FROM coins
      WHERE UPPER(symbol) IN (${FROM}, ${TO})
    `) as unknown as Array<{ symbol: string; price: number }>;

    const priceMap: Record<string, number> = {};
    for (const r of priceRows) priceMap[r.symbol] = Number(r.price || 0);

    const pFrom = priceMap[FROM] || 0;
    const pTo = priceMap[TO] || 0;
    if (!pFrom || !pTo) return bad('price unavailable for one or more symbols', 400);

    // ── begin atomic exchange
    try {
      // ensure rows exist
      await sql`
        INSERT INTO user_balances (user_id, coin_symbol, balance, locked_balance, created_at, updated_at)
        VALUES (${user_id}, ${FROM}, 0, 0, NOW(), NOW())
        ON CONFLICT (user_id, coin_symbol) DO NOTHING
      `;
      await sql`
        INSERT INTO user_balances (user_id, coin_symbol, balance, locked_balance, created_at, updated_at)
        VALUES (${user_id}, ${TO}, 0, 0, NOW(), NOW())
        ON CONFLICT (user_id, coin_symbol) DO NOTHING
      `;

      // Get current balance for FROM coin
      const fromBalRows = (await sql`
        SELECT balance::float AS balance
        FROM user_balances
        WHERE user_id = ${user_id} AND UPPER(coin_symbol) = ${FROM}
        LIMIT 1
      `) as unknown as Array<{ balance: number }>;

      const have = Number(fromBalRows?.[0]?.balance ?? 0);
      if (have < amount) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            ok: false,
            message: `insufficient ${FROM} balance (need ${amount}, have ${have})`,
          }),
        };
      }

      // value & fee
      const valueUSD = amount * pFrom;
      const feeUSD = valueUSD * 0.001; // 0.1%
      const toAmount = (valueUSD - feeUSD) / pTo;

      // Update balances atomically
      await sql`
        UPDATE user_balances
        SET balance = balance - ${amount}, updated_at = NOW()
        WHERE user_id = ${user_id} AND UPPER(coin_symbol) = ${FROM}
      `;

      await sql`
        INSERT INTO user_balances (id, user_id, coin_symbol, balance, locked_balance, created_at, updated_at)
        VALUES (${randomUUID()}, ${user_id}, ${TO}, ${toAmount}, 0, NOW(), NOW())
        ON CONFLICT (user_id, coin_symbol)
        DO UPDATE SET
          balance = user_balances.balance + ${toAmount},
          updated_at = NOW()
        WHERE user_id = ${user_id} AND UPPER(coin_symbol) = ${TO}
      `;

      // record transaction
      const txId = randomUUID();
      await sql`
        INSERT INTO transactions
          (id, user_id, type, from_symbol, to_symbol, amount, to_amount, fee, status, created_at, updated_at)
        VALUES
          (${txId}, ${user_id}, 'exchange', ${FROM}, ${TO}, ${amount}, ${toAmount}, ${feeUSD}, 'completed', NOW(), NOW())
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, id: txId, to_amount: toAmount, fee: feeUSD }),
      };
    } catch (err) {
      throw err;
    }
  } catch (e: any) {
    console.error('exchange error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: String(e?.message || e) }) };
  }

  function bad(message: string, status = 400) {
    return { statusCode: status, headers, body: JSON.stringify({ ok: false, message }) };
  }
};
