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

// Nama bulan lokal (prototype F-17: "Agustus 2026", bukan "Bulan 8 2026").
const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function PeriodLockPage() {
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bulan berjalan jadi titik awal daftar 12 bulan ke belakang.
  const year = parseInt(todayJakarta().slice(0, 4), 10);
  const month = parseInt(todayJakarta().slice(5, 7), 10);

  function load() {
    apiFetch<PeriodLock[]>("/api/period-locks").then(setLocks).catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }
  useEffect(load, []);

  async function lockPeriod(targetYear: number, targetMonth: number) {
    setError(null);
    try {
      await apiFetch("/api/period-locks", {
        method: "POST",
        body: JSON.stringify({ year: targetYear, month: targetMonth }),
      });
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

  // Prototype F-17 menampilkan SATU daftar berisi periode terbuka maupun
  // terkunci, dengan tombol kontekstual per baris. API hanya menyimpan yang
  // terkunci, jadi daftar periode diturunkan di sini (12 bulan terakhir) lalu
  // dicocokkan dengan lock yang ada — tidak perlu endpoint baru.
  const periods = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, month - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return { year: y, month: m, lock: locks.find((l) => l.year === y && l.month === m) ?? null };
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Period lock</h1>
      {error && <Banner variant="danger">{error}</Banner>}

      <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
        {periods.map((p) => (
          <div key={`${p.year}-${p.month}`} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${p.lock ? "bg-ink-400" : "bg-ok"}`}
              />
              <span className="truncate font-medium text-ink-900">
                {MONTHS_ID[p.month - 1]} {p.year}
              </span>
              <span className="shrink-0 text-[13px] text-ink-400">{p.lock ? "Terkunci" : "Terbuka"}</span>
            </span>
            {p.lock ? (
              <button type="button" onClick={() => unlockPeriod(p.lock!.id)} className="shrink-0 text-[13px] text-danger">
                Buka kunci
              </button>
            ) : (
              <button
                type="button"
                onClick={() => lockPeriod(p.year, p.month)}
                className="h-9 shrink-0 rounded-lg bg-navy-900 px-3 text-[13px] font-semibold text-white"
              >
                Kunci periode
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
