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

const emptyForm = { full_name: "", whatsapp: "", email: "", role: "cs" as AppRole, password: "" };

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [linkBanner, setLinkBanner] = useState<{ label: string; link: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Konfirmasi dua-ketuk, bukan window.confirm(): dialog native sering
  // diblokir/ditekan di browser HP, jadi tombolnya terlihat "tidak berfungsi".
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function load() {
    apiFetch<UserRow[]>("/api/users").then(setUsers).catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }
  useEffect(load, []);

  async function addUser() {
    setCreating(true);
    setError(null);
    try {
      const created = await apiFetch<{ email: string }>("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      // Owner sudah tahu passwordnya (dia yang mengetik), jadi tidak ada
      // tautan untuk direlai — cukup konfirmasi akun siap dipakai.
      setLinkBanner(null);
      setNotice(`Akun ${created.email} dibuat dan langsung bisa dipakai login.`);
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

  async function deleteUser(u: UserRow) {
    // Ketukan pertama hanya meminta konfirmasi (tombol berubah jadi "Yakin,
    // hapus?"); ketukan kedua yang benar-benar menghapus.
    if (confirmDeleteId !== u.id) {
      setConfirmDeleteId(u.id);
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(u.id);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/users?id=${u.id}`, { method: "DELETE" });
      setNotice(`User ${u.full_name} dihapus.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus user");
    } finally {
      setDeletingId(null);
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

  async function resetPassword(u: UserRow) {
    setResettingId(u.id);
    setError(null);
    try {
      const result = await apiFetch<{ reset_link: string }>(`/api/users/${u.id}/reset-password`, {
        method: "POST",
      });
      setLinkBanner({
        label: `Tautan reset password untuk ${u.full_name} (sekali pakai):`,
        link: result.reset_link,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat tautan reset");
    } finally {
      setResettingId(null);
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
          <option value="hrd">HRD</option>
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => resetPassword(u)}
            disabled={resettingId === u.id}
            className="h-9 rounded-lg border border-line px-3 text-sm font-medium disabled:opacity-50"
          >
            {resettingId === u.id ? "Membuat..." : "Reset password"}
          </button>
          <button
            type="button"
            onClick={() => toggleActive(u)}
            className="h-9 rounded-lg border border-line px-3 text-sm font-medium"
          >
            {u.is_active ? "Nonaktifkan" : "Aktifkan"}
          </button>
          <button
            type="button"
            onClick={() => deleteUser(u)}
            disabled={deletingId === u.id}
            className={`h-9 rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${
              confirmDeleteId === u.id
                ? "bg-danger text-white"
                : "border border-danger/40 text-danger"
            }`}
          >
            {deletingId === u.id
              ? "Menghapus..."
              : confirmDeleteId === u.id
                ? "Yakin, hapus?"
                : "Hapus"}
          </button>
        </div>
      ),
    },
  ];

  // Aksi yang sama dipakai ulang di kartu mobile — tanpa ini, tombol kelola
  // hanya muncul di tabel desktop dan tak terjangkau dari HP.
  const rowActions = columns[columns.length - 1].render!;

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

      {linkBanner && (
        <Banner variant="ok">
          <p>{linkBanner.label} Kirim lewat WA.</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={linkBanner.link}
              onFocus={(e) => e.target.select()}
              className="h-9 flex-1 rounded-lg border border-line bg-paper px-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(linkBanner.link)}
              className="h-9 shrink-0 rounded-lg border border-line px-3 text-xs font-medium"
            >
              Salin
            </button>
          </div>
        </Banner>
      )}

      {notice && <Banner variant="ok">{notice}</Banner>}

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
          {/* Owner mengetik password di sini dan menyerahkannya langsung ke
              user — tidak ada tautan undangan yang perlu direlai. */}
          <input
            placeholder="Password (minimal 8 karakter)"
            type="text"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            className="h-9 w-full rounded-lg border border-line px-2 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as AppRole }))}
            className="h-9 w-full rounded-lg border border-line px-2 text-sm"
          >
            <option value="cs">CS</option>
            <option value="advertiser">Advertiser</option>
            <option value="hrd">HRD</option>
            <option value="owner">Owner</option>
          </select>
          <button
            type="button"
            onClick={addUser}
            disabled={creating || !form.full_name || !form.whatsapp || !form.email || form.password.length < 8}
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
        cardActions={(u) => rowActions(u)}
        cardAccent={(u) => (u.is_active ? "Aktif" : "Nonaktif")}
      />
    </div>
  );
}
