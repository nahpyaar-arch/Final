import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
const headers = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' };

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode:405, headers, body:JSON.stringify({ ok:false, error:'Use POST' }) };
    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode:500, headers, body:JSON.stringify({ ok:false, error:'DATABASE_URL not set' }) };
    const sql = neon(dbUrl);

    const { user_id, from_symbol, to_symbol, from_amount, to_amount } = JSON.parse(event.body || '{}');
    if (!user_id || !from_symbol || !to_symbol || !from_amount || !to_amount) {
      return { statusCode:400, headers, body:JSON.stringify({ ok:false, error:'Missing params' }) };
    }

    await sql`begin`;

    const fromBal = (await sql`
      select balance from user_balances
      where user_id=${user_id} and coin_symbol=${from_symbol}
      for update
    `)[0]?.balance || 0;

    if (Number(fromBal) < Number(from_amount)) {
      await sql`rollback`;
      return { statusCode:400, headers, body:JSON.stringify({ ok:false, error:'insufficient balance' }) };
    }

    await sql`
      update user_balances
      set balance = balance - ${from_amount}, updated_at = now()
      where user_id=${user_id} and coin_symbol=${from_symbol}
    `;

    await sql`
      insert into user_balances (user_id, coin_symbol, balance, locked_balance)
      values (${user_id}, ${to_symbol}, ${to_amount}, 0)
      on conflict (user_id, coin_symbol) do update
      set balance = user_balances.balance + excluded.balance,
          updated_at = now()
    `;

    await sql`commit`;

    const balances = await sql`
      select coin_symbol, balance, locked_balance
      from user_balances where user_id=${user_id} order by coin_symbol
    `;
    return { statusCode:200, headers, body:JSON.stringify({ ok:true, balances }) };
  } catch (e:any) {
    try { const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL; if (dbUrl) await neon(dbUrl)`rollback`; } catch {}
    return { statusCode:500, headers, body:JSON.stringify({ ok:false, error:String(e.message||e) }) };
  }
};
