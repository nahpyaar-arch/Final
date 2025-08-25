// netlify/functions/get-user-data.ts
import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export const handler: Handler = async (event) => {
  try {
    const dbUrl =
      process.env.DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      process.env.VITE_DATABASE_URL;
    if (!dbUrl) return resp(500, { ok: false, error: 'DATABASE_URL not set' });

    const sql = neon(dbUrl);

    // ✅ use rawQuery (string) to avoid TS clash with EventQueryStringParameters
    const qs = new URLSearchParams(event.rawQuery || '');
    const id = qs.get('id') || '';
    const email = qs.get('email') || '';
    if (!id && !email) return resp(400, { ok: false, error: 'Provide id or email' });

    // profile
    const profRows = (await (id
      ? sql`SELECT id, email, name, is_admin, language, created_at, updated_at FROM profiles WHERE id = ${id} LIMIT 1`
      : sql`SELECT id, email, name, is_admin, language, created_at, updated_at FROM profiles WHERE email = ${email} LIMIT 1`
    )) as unknown as Array<any>;

    const profile = profRows?.[0];
    if (!profile) return resp(404, { ok: false, error: 'User not found' });

    // balances (UPPERCASE symbols, numeric)
    const balRows = (await sql`
      SELECT UPPER(coin_symbol) AS coin_symbol, balance::float AS balance
      FROM user_balances
      WHERE user_id = ${profile.id}
      ORDER BY coin_symbol
    `) as unknown as Array<{ coin_symbol: string; balance: number }>;

    // recent transactions (optional)
    const txRows = (await sql`
      SELECT id, user_id, type, status, coin_symbol, from_symbol, to_symbol,
             amount::float, to_amount::float, fee::float, details,
             created_at, updated_at
      FROM transactions
      WHERE user_id = ${profile.id}
      ORDER BY created_at DESC
      LIMIT 200
    `) as unknown as Array<any>;

    return resp(200, { ok: true, profile, balances: balRows, transactions: txRows });
  } catch (e: any) {
    console.error('get-user-data error', e);
    return resp(500, { ok: false, error: String(e?.message || e) });
  }
};

function resp(statusCode: number, body: any) {
  return { statusCode, headers, body: JSON.stringify(body) };
}
