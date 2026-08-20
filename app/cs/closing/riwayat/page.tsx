"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { formatDateID } from "@/lib/utils/date";
import { formatRupiah } from "@/lib/utils/rupiah";

// v_closings_cs never carries cost/profit columns -- RLS relies on that
// (10-AUDIT-FE-BE.md #12). Only list the fields the endpoint actually
// returns; don't fill in anything from elsewhere.
interface ClosingRow {
  id: string;
  first_name: string;
  last_name: string | null;
  closing_date: string;
  program_id: string;
  total_value: number;
  payment_status: "dp" | "partial" | "lunas" | "refunded" | "cancelled";
}

interface Program {
  id: string;
  name: string;
}

const STATUS_LABEL: Record<ClosingRow["payment_status"], string> = {
  dp: "DP",
  partial: "Cicilan",
  lunas: "Lunas",
  refunded: "Refund",
  cancelled: "Dibatalkan",
};

const STATUS_CLASS: Record<ClosingRow["payment_status"], string> = {
  dp: "bg-warn/10 text-warn-ink",
  partial: "bg-blue/10 text-ink-900",
  lunas: "bg-ok/10 text-ok",
  refunded: "bg-danger/10 text-danger",
  cancelled: "bg-line text-ink-400",
};

export default function ClosingRiwayatPage() {
  const router = useRouter();
  const [closings, setClosings] = useState<ClosingRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch<ClosingRow[]>("/api/closings"), apiFetch<Program[]>("/api/programs")])
      .then(([c, p]) => {
        setClosings(c);
        setPrograms(p);
      })
      .finally(() => setLoading(false));
  }, []);

  const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? "-";

  return (
    <div className="pb-6">
      <header className="flex items-center gap-3 border-b border-line bg-card px-[18px] py-3.5">
        <button type="button" onClick={() => router.push("/cs")} aria-label="Kembali" className="text-[22px] text-ink-600">
          ‹
        </button>
        <h1 className="flex-1 font-display text-[17px] font-semibold text-ink-900">Closing saya</h1>
        <Link href="/cs/closing" className="text-sm font-medium text-brass">
          + Baru
        </Link>
      </header>

      <div className="p-4">
        {loading && <p className="text-sm text-ink-400">Memuat...</p>}
        {!loading && closings.length === 0 && (
          <p className="rounded-[10px] border border-line bg-card p-4 text-sm text-ink-400">
            Belum ada closing yang tercatat.
          </p>
        )}
        <div className="space-y-2.5">
          {closings.map((c) => (
            <Link
              key={c.id}
              href={`/cs/closing/riwayat/${c.id}`}
              className="block rounded-[10px] border border-line bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-900">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {programName(c.program_id)} · {formatDateID(c.closing_date)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.payment_status]}`}>
                  {STATUS_LABEL[c.payment_status]}
                </span>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-ink-900">{formatRupiah(c.total_value)}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
