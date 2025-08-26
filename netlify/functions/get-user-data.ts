import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export const handler: Handler = async (event) => {
  try {
    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error:'DATABASE_URL not set' }) };
    const sql = neon(dbUrl);

    const qs = new URLSearchParams(event.rawQuery || '');
    const id = qs.get('id') || '';
    const email = qs.get('email') || '';
    if (!id && !email) return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Provide id or email' }) };

    const prof = (await (id
      ? sql`select id,email,name,is_admin,language,created_at from profiles where id=${id} limit 1`
      : sql`select id,email,name,is_admin,language,created_at from profiles where email=${email} limit 1`))[0];

    if (!prof) return { statusCode: 404, headers, body: JSON.stringify({ ok:false, error:'User not found' }) };

    const balances = await sql`
      select coin_symbol, balance, locked_balance, updated_at
      from user_balances
      where user_id=${prof.id}
      order by coin_symbol
    `;

    const txs = await sql`
      select id,type,status,coin_symbol,amount,created_at
      from transactions
      where user_id=${prof.id}
      order by created_at desc
      limit 20
    `;

    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, profile: prof, balances, txs }) };
  } catch (e:any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error:String(e.message||e) }) };
  }
};
