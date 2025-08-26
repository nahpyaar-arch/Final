import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async () => {
  const serverUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL || '';
  const sql = serverUrl ? neon(serverUrl) : null;

  const fromServer = sql
    ? await sql`SELECT current_database() AS db, inet_server_addr()::text AS host, NOW() AS ts`
    : [{ db: null, host: null, ts: null }];

  // also expose what the client will see at build/runtime
  const fromClient = {
    viteUrlPresent: typeof import.meta !== 'undefined' && !!(import.meta as any).env?.VITE_DATABASE_URL,
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      server: { db: fromServer[0].db, host: fromServer[0].host },
      client: fromClient,
      haveEnv: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        VITE_DATABASE_URL: !!process.env.VITE_DATABASE_URL,
      },
    }),
  };
};
