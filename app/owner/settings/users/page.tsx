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
  email: string | null;
}

const emptyForm = { full_name: "", whatsapp: "", email: "", role: "cs" as AppRole };

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  function load() {
    apiFetch<UserRow[]>("/api/users").then(setUsers).catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }
  useEffect(load, []);

  async function addUser() {
    setCreating(true);
    setError(null);
    try {
      const created = await apiFetch<{ email: string; temp_password: string }>("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setTempPassword({ email: created.email, password: created.temp_password });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah user");
    } finally {
      setCreating(false);
    }
  }

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
      key: "email",
      header: "Email",
      accessor: (r) => r.email,
      render: (u) => u.email ?? "-",
      cardLabel: "Email",
    },
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
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="h-10 rounded-lg bg-brass px-4 text-sm font-semibold text-on-brass"
        >
          + Tambah user
        </button>
      </div>
      {error && <Banner variant="danger">{error}</Banner>}

      {tempPassword && (
        <Banner variant="ok">
          Akun {tempPassword.email} dibuat. Password sementara:{" "}
          <span className="font-mono font-semibold">{tempPassword.password}</span> — sampaikan ke CS lewat WA,
          belum ada alur ganti password di aplikasi.
        </Banner>
      )}

      {showForm && (
        <div className="space-y-2 rounded-[10px] border border-dashed border-line p-3">
          <input
            placeholder="Nama"
            value={form.full_name}
            onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
            className="h-9 w-full rounded-lg border border-line px-2 text-sm"
          />
          <input
            placeholder="Nomor WhatsApp"
            value={form.whatsapp}
            onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value }))}
            className="h-9 w-full rounded-lg border border-line px-2 text-sm"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            className="h-9 w-full rounded-lg border border-line px-2 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as AppRole }))}
            className="h-9 w-full rounded-lg border border-line px-2 text-sm"
          >
            <option value="cs">CS</option>
            <option value="advertiser">Advertiser</option>
            <option value="owner">Owner</option>
          </select>
          <button
            type="button"
            onClick={addUser}
            disabled={creating || !form.full_name || !form.whatsapp || !form.email}
            className="h-9 w-full rounded-lg bg-brass text-sm font-semibold text-on-brass disabled:opacity-50"
          >
            {creating ? "Menambah..." : "Simpan"}
          </button>
        </div>
      )}

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
