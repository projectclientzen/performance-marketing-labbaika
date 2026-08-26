"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { Banner } from "@/components/ui/Banner";

interface Source {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

/** Kelola lead source (Facebook, Google, dst). Sampai sekarang master data ini
 *  hanya bisa diisi lewat SQL; halaman ini memberi owner cara menambah dan
 *  menonaktifkannya dari aplikasi. */
export default function LeadSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<Source[]>("/api/lead-sources")
      .then(setSources)
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"));
  }
  useEffect(load, []);

  async function addSource() {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch("/api/lead-sources", { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah sumber");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(s: Source) {
    setError(null);
    try {
      await apiFetch(`/api/lead-sources/${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !s.is_active }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah sumber");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-ink-900">Lead Source</h1>
      <p className="text-sm text-ink-600">
        Sumber lead yang bisa dipilih CS saat mengisi laporan harian.
      </p>
      {error && <Banner variant="danger">{error}</Banner>}

      <div className="flex gap-2 rounded-[10px] border border-dashed border-line p-3">
        <input
          placeholder="Nama sumber baru (mis. TikTok)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 flex-1 rounded-lg border border-line px-2 text-sm"
        />
        <button
          type="button"
          onClick={addSource}
          disabled={adding || !name.trim()}
          className="h-9 shrink-0 rounded-lg bg-brass px-4 text-sm font-semibold text-on-brass disabled:opacity-50"
        >
          {adding ? "Menambah..." : "Tambah"}
        </button>
      </div>

      <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
        {sources.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-3 text-sm">
            <span className="flex items-center gap-2">
              <span aria-hidden className={`h-2 w-2 rounded-full ${s.is_active ? "bg-ok" : "bg-ink-400"}`} />
              <span className={`font-medium ${s.is_active ? "text-ink-900" : "text-ink-400"}`}>{s.name}</span>
            </span>
            <button
              type="button"
              onClick={() => toggle(s)}
              className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium"
            >
              {s.is_active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </div>
        ))}
        {sources.length === 0 && <p className="p-3 text-sm text-ink-400">Belum ada sumber.</p>}
      </div>
    </div>
  );
}
