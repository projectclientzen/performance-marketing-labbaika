"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface PeriodLock {
  id: string;
  year: number;
  month: number;
  locked_at: string;
}

export default function PeriodLockPage() {
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(parseInt(todayJakarta().slice(0, 4), 10));
  const [month, setMonth] = useState(parseInt(todayJakarta().slice(5, 7), 10));

  function load() {
    apiFetch<PeriodLock[]>("/api/period-locks").then(setLocks).catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }
  useEffect(load, []);

  async function lockPeriod() {
    setError(null);
    try {
      await apiFetch("/api/period-locks", { method: "POST", body: JSON.stringify({ year, month }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunci periode");
    }
  }

  async function unlockPeriod(id: string) {
    const reason = window.prompt("Alasan membuka periode ini?");
    if (!reason) return;
    setError(null);
    try {
      await apiFetch(`/api/period-locks/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuka periode");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Period lock</h1>
      {error && <Banner variant="danger">{error}</Banner>}

      <div className="flex items-end gap-2 rounded-[10px] border border-line bg-card p-3">
        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="h-10 rounded-lg border border-line px-2 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>Bulan {m}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="h-10 w-24 rounded-lg border border-line px-2 text-sm" />
        <button type="button" onClick={lockPeriod} className="h-10 rounded-lg bg-brass px-4 text-sm font-semibold text-navy-900">
          Kunci periode
        </button>
      </div>

      <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
        {locks.map((l) => (
          <div key={l.id} className="flex items-center justify-between p-3 text-sm">
            <span className="font-medium text-ink-900">Bulan {l.month} {l.year}</span>
            <button type="button" onClick={() => unlockPeriod(l.id)} className="text-danger">
              Buka kunci
            </button>
          </div>
        ))}
        {locks.length === 0 && <p className="p-3 text-sm text-ink-400">Belum ada periode terkunci.</p>}
      </div>
    </div>
  );
}
