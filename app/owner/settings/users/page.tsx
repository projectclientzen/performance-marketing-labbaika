"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Banner } from "@/components/ui/Banner";

interface UserRow {
  id: string;
  full_name: string;
  role: "owner" | "cs";
  is_active: boolean;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<UserRow[]>("/api/users").then(setUsers).catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }
  useEffect(load, []);

  async function toggleActive(u: UserRow) {
    try {
      await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id: u.id, is_active: !u.is_active }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah user");
    }
  }

  async function changeRole(u: UserRow, role: "owner" | "cs") {
    try {
      await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id: u.id, role }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah role");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Manajemen user</h1>
      <p className="text-xs text-ink-400">Membuat akun baru butuh akses Supabase Auth langsung — belum ada di UI ini.</p>
      {error && <Banner variant="danger">{error}</Banner>}

      <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="text-sm font-medium text-ink-900">{u.full_name}</p>
              <p className="text-xs text-ink-400">{u.is_active ? "Aktif" : "Nonaktif"}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => changeRole(u, e.target.value as "owner" | "cs")}
                className="h-9 rounded-lg border border-line px-2 text-sm"
              >
                <option value="cs">CS</option>
                <option value="owner">Owner</option>
              </select>
              <button
                type="button"
                onClick={() => toggleActive(u)}
                className="h-9 rounded-lg border border-line px-3 text-sm font-medium"
              >
                {u.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
