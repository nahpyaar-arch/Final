import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
const headers = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' };

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode:405, headers, body:JSON.stringify({ ok:false, error:'Use POST' }) };
    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode:500, headers, body:JSON.stringify({ ok:false, error:'DATABASE_URL not set' }) };
    const sql = neon(dbUrl);

    const { tx_id } = JSON.parse(event.body || '{}');
    if (!tx_id) return { statusCode:400, headers, body:JSON.stringify({ ok:false, error:'tx_id required' }) };

    await sql`begin`;

    const tx = (await sql`
      update transactions
      set status='approved'
      where id=${tx_id} and type='withdraw'
      returning id, user_id, coin_symbol, amount
    `)[0];
    if (!tx) { await sql`rollback`; return { statusCode:404, headers, body:JSON.stringify({ ok:false, error:'withdraw not found' }) }; }

    const bal = (await sql`
      select balance from user_balances
      where user_id=${tx.user_id} and coin_symbol=${tx.coin_symbol}
      for update
    `)[0]?.balance || 0;

    if (Number(bal) < Number(tx.amount)) {
      await sql`rollback`;
      return { statusCode:400, headers, body:JSON.stringify({ ok:false, error:'insufficient balance' }) };
    }

    await sql`
      update user_balances
      set balance = balance - ${tx.amount}, updated_at = now()
      where user_id=${tx.user_id} and coin_symbol=${tx.coin_symbol}
    `;

    await sql`commit`;

    const balances = await sql`
      select coin_symbol, balance, locked_balance
      from user_balances where user_id=${tx.user_id} order by coin_symbol
    `;
    return { statusCode:200, headers, body:JSON.stringify({ ok:true, balances }) };
  } catch (e:any) {
    try { const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL; if (dbUrl) await neon(dbUrl)`rollback`; } catch {}
    return { statusCode:500, headers, body:JSON.stringify({ ok:false, error:String(e.message||e) }) };
  }
};
