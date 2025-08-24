
import type { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  try {
    // If you have Neon DB: ping it here
    // await db.query("SELECT 1");
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ts: Date.now() }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: e.message }),
    };
  }
};
