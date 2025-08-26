// src/pages/DebugEnv.tsx
// Dev-only utilities: Env readout + MOON Daily Target Planner (via Netlify Functions)

import { useEffect, useMemo, useState } from 'react';

type PlanRow = { day: string; target_pct: number; note: string };

const fmtJST = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export default function DebugEnv() {
  // ───────────────────────────────────────────────────────────
  // Env readout (DB URL masked; server should use DATABASE_URL)
  // ───────────────────────────────────────────────────────────
  const vals = useMemo(
    () => ({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '(not set)',
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
        ? String(import.meta.env.VITE_SUPABASE_ANON_KEY).slice(0, 8) + '…'
        : '(anon key not set)',

      // 👇 force Vite to inject this var; mask it in UI
      VITE_DATABASE_URL: import.meta.env.VITE_DATABASE_URL
        ? String(import.meta.env.VITE_DATABASE_URL).slice(0, 32) + '…'
        : '(not set)',

      // Server-only note
      DATABASE_URL:
        '(server-only: set DATABASE_URL in Netlify env for Functions)',

      VITE_PRICE_POLL_MS: import.meta.env.VITE_PRICE_POLL_MS ?? '(default 15000)',
      VITE_PRICE_PERSIST_MS:
        import.meta.env.VITE_PRICE_PERSIST_MS ?? '(default 60000)',
      NODE_ENV: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
    }),
    []
  );

  // ───────────────────────────────────────────────────────────
  // MOON Daily Target Planner (client → Netlify Functions)
  // ───────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pct, setPct] = useState<string>('');
  const [note, setNote] = useState('');
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fromStr = fmtJST(addDays(selectedDate, -10));
  const toStr = fmtJST(addDays(selectedDate, +10));
  const dayStr = fmtJST(selectedDate);

  async function loadPlans() {
    try {
      setErr(null);
      const url = `/.netlify/functions/get-moon-plans?from=${encodeURIComponent(
        fromStr
      )}&to=${encodeURIComponent(toStr)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`get-moon-plans ${res.status}`);
      const data = (await res.json()) as { plans?: PlanRow[] };
      setPlans(data.plans ?? []);
    } catch (e: any) {
      console.error(e);
      setErr(String(e?.message || e));
      setPlans([]);
    }
  }

  async function handleSave() {
    if (pct === '' || isNaN(Number(pct))) {
      setErr('Please enter a numeric % target.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await fetch('/.netlify/functions/upsert-moon-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: dayStr,
          target_pct: Number(pct),
          note,
        }),
      });
      await loadPlans();
    } catch (e: any) {
      console.error(e);
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(day: string) {
    if (!confirm(`Delete plan for ${day}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await fetch('/.netlify/functions/delete-moon-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day }),
      });
      await loadPlans();
    } catch (e: any) {
      console.error(e);
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadPlans().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromStr, toStr]);

  // ───────────────────────────────────────────────────────────
  // UI
  // ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-10">
      {/* Env readout */}
      <section>
        <h1 className="text-xl font-semibold mb-4">Debug Env</h1>
        <pre className="bg-gray-800 rounded-lg p-4 border border-gray-700 overflow-auto">
          {JSON.stringify(vals, null, 2)}
        </pre>
        <p className="text-xs text-gray-400 mt-2">
          DB connection string is server-only. Netlify Functions read <code>DATABASE_URL</code>.
        </p>
      </section>

      {/* MOON Daily Target Planner */}
      <section>
        <h2 className="text-lg font-semibold mb-4">MOON Daily Target Planner</h2>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Date (JST) */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm text-gray-300">Date (JST)</label>
            <input
              type="date"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
              value={dayStr}
              onChange={(e) => {
                const parts = e.target.value.split('-').map(Number);
                const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
                setSelectedDate(
                  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
                );
              }}
            />
          </div>

          {/* % Target */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm text-gray-300">
              % Target (e.g. 20 = +20%)
            </label>
            <input
              inputMode="decimal"
              type="number"
              step="any"
              placeholder="e.g. 20"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </div>

          {/* Note */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm text-gray-300">Note (optional)</label>
            <input
              type="text"
              placeholder="reason / campaign"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={handleSave}
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-4 py-2"
          >
            Save / Update
          </button>
          <button
            onClick={() => loadPlans()}
            disabled={busy}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded px-4 py-2"
          >
            Refresh
          </button>
          <span className="text-sm text-gray-400 self-center">
            Showing plans from <span className="font-mono">{fromStr}</span> to{' '}
            <span className="font-mono">{toStr}</span>
          </span>
        </div>

        {err && (
          <div className="mt-3 text-sm text-red-300">
            Error: <span className="font-mono">{err}</span>
          </div>
        )}

        {/* Plans table */}
        <div className="mt-6 overflow-x-auto border border-gray-800 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">% Target</th>
                <th className="text-left px-4 py-2">Note</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-gray-400" colSpan={4}>
                    No plans in range
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.day} className="border-t border-gray-800">
                    <td className="px-4 py-2 font-mono">{p.day}</td>
                    <td className="px-4 py-2">{Number(p.target_pct).toFixed(2)}</td>
                    <td className="px-4 py-2">{p.note || '-'}</td>
                    <td className="px-4 py-2">
                      <button
                        className="text-red-300 hover:text-red-200"
                        onClick={() => handleDelete(p.day)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
