"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Banner } from "@/components/ui/Banner";
import { formatAuditMessage } from "@/lib/utils/audit";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  created_at: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  app_users: { full_name: string } | { full_name: string }[] | null;
}
interface Program {
  id: string;
  name: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [programNameById, setProgramNameById] = useState<Record<string, string>>({});
  const [table, setTable] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Program[]>("/api/programs").then((programs) =>
      setProgramNameById(Object.fromEntries(programs.map((p) => [p.id, p.name]))),
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = table ? `?table=${table}` : "";
    apiFetch<AuditLog[]>(`/api/audit-logs${query}`)
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [table]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Audit log</h1>
      {error && <Banner variant="danger">{error}</Banner>}

      <select value={table} onChange={(e) => setTable(e.target.value)} className="h-10 rounded-lg border border-line px-2 text-sm">
        <option value="">Semua tabel</option>
        <option value="lead_reports">lead_reports</option>
        <option value="closings">closings</option>
        <option value="program_prices">program_prices</option>
        <option value="period_locks">period_locks</option>
        <option value="app_users">app_users</option>
      </select>

      {loading && <p className="text-sm text-ink-400">Memuat...</p>}

      <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
        {logs.map((l) => {
          const actor = Array.isArray(l.app_users) ? l.app_users[0] : l.app_users;
          return (
            <div key={l.id} className="p-3 text-sm">
              <p className="text-ink-900">
                <span className="font-medium">{actor?.full_name ?? "Sistem"}</span>{" "}
                {formatAuditMessage(l, programNameById)}
              </p>
              <p className="text-xs text-ink-400">{new Date(l.created_at).toLocaleString("id-ID")}</p>
            </div>
          );
        })}
        {logs.length === 0 && !loading && <p className="p-3 text-sm text-ink-400">Tidak ada log.</p>}
      </div>
    </div>
  );
}
