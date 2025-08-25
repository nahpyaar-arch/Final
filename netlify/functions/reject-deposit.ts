import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Use POST' };
    const dbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    if (!dbUrl) return { statusCode: 500, body: 'DATABASE_URL not set' };
    const sql = neon(dbUrl);
    const { id } = JSON.parse(event.body || '{}');
    if (!id) return { statusCode: 400, body: 'Missing id' };

    const res = await sql`
      UPDATE transactions
         SET status = 'rejected', updated_at = NOW()
       WHERE id = ${id}::uuid
         AND type = 'deposit'
         AND status = 'pending'
       RETURNING 1
    `;
    if (res.length === 0) return { statusCode: 404, body: 'Not found or not pending' };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error('reject-deposit', e);
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
