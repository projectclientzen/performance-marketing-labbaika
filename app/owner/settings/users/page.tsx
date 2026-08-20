"use client";

import type { AppRole } from "@/lib/auth/roles";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Banner } from "@/components/ui/Banner";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

interface UserRow {
  id: string;
  full_name: string;
  role: AppRole;
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

  async function changeRole(u: UserRow, role: AppRole) {
    try {
      await apiFetch("/api/users", { method: "PATCH", body: JSON.stringify({ id: u.id, role }) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah role");
    }
  }

  const columns: DataTableColumn<UserRow>[] = [
    { key: "full_name", header: "Nama", accessor: (r) => r.full_name, cardLabel: "Nama" },
    {
      key: "role",
      header: "Peran",
      accessor: (r) => r.role,
      render: (u) => (
        <select
          value={u.role}
          onChange={(e) => changeRole(u, e.target.value as AppRole)}
          className="h-9 rounded-lg border border-line px-2 text-sm"
        >
          <option value="cs">CS</option>
          <option value="advertiser">Advertiser</option>
          <option value="owner">Owner</option>
        </select>
      ),
      cardLabel: "Peran",
    },
    {
      key: "is_active",
      header: "Status",
      accessor: (r) => (r.is_active ? "Aktif" : "Nonaktif"),
      render: (u) => (
        <span className={u.is_active ? "text-ok" : "text-ink-400"}>
          ● {u.is_active ? "Aktif" : "Nonaktif"}
        </span>
      ),
      cardLabel: "Status",
    },
    {
      key: "kelola",
      header: "",
      accessor: () => null,
      render: (u) => (
        <button
          type="button"
          onClick={() => toggleActive(u)}
          className="h-9 rounded-lg border border-line px-3 text-sm font-medium"
        >
          {u.is_active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-ink-900">Manajemen user</h1>
      </div>
      <p className="text-xs text-ink-400">Membuat akun baru butuh akses Supabase Auth langsung — belum ada di UI ini.</p>
      {error && <Banner variant="danger">{error}</Banner>}

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        cardTitle={(u) => u.full_name}
        cardAccent={(u) => (u.is_active ? "Aktif" : "Nonaktif")}
      />
    </div>
  );
}
