"use client";

import { useEffect, useState } from "react";
import { useRefetchOnFocus } from "@/lib/hooks/useRefetchOnFocus";
import { apiFetch, ApiError } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatDateID, todayJakarta } from "@/lib/utils/date";
import { Banner } from "@/components/ui/Banner";

interface Program {
  id: string;
  name: string;
  destination: string;
  duration_days: number;
}
interface Departure {
  id: string;
  program_id: string;
  departure_date: string;
}
interface PriceRow {
  id: string;
  program_id: string;
  room_type: string;
  price: number;
  effective_date: string;
  end_date: string | null;
}
const ROOM_TYPES = ["quad", "triple", "double", "child", "infant"];

export function ProgramManager() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Harga ikut di form pembuatan program. Sebelumnya program harus disimpan
  // dulu, dipilih lagi, baru harganya diisi di panel terpisah — tiga langkah
  // untuk satu hal, dan program tanpa harga sama sekali tidak bisa dipakai CS
  // karena pencarian harga di form closing selalu gagal.
  //
  // Quad wajib: itu harga acuan program. Triple dan double opsional — diisi
  // belakangan kalau memang ada yang mendaftar di tipe itu.
  const [newProgram, setNewProgram] = useState({
    name: "",
    destination: "",
    duration_days: 9,
    quad: "",
    triple: "",
    double: "",
  });
  const [newDeparture, setNewDeparture] = useState({ departure_date: "" });
  // price sengaja string kosong, bukan 0: input number yang sudah berisi 0
  // menyembunyikan placeholder "Harga", jadi kolomnya terbaca sudah terisi —
  // lalu Tambah ditolak `price harus lebih dari 0` tanpa petunjuk kolom mana.
  const [newPrice, setNewPrice] = useState({ room_type: "quad", price: "", effective_date: "" });

  function loadPrograms() {
    apiFetch<Program[]>("/api/programs").then(setPrograms);
  }
  useEffect(loadPrograms, []);
  // Segarkan daftar program saat tab difokuskan — program yang ditambah
  // pengguna/role lain langsung muncul tanpa reload manual.
  useRefetchOnFocus(loadPrograms);

  function loadDetail(programId: string) {
    setSelected(programId);
    apiFetch<Departure[]>(`/api/programs/${programId}/departures`).then(setDepartures);
    apiFetch<PriceRow[]>(`/api/programs/${programId}/prices`).then(setPrices);
  }

  /**
   * Amplop API membalas VALIDATION_ERROR dengan pesan umum plus `fields` berisi
   * kalimat per kolom. Sebelumnya hanya pesan umumnya yang ditampilkan, jadi
   * "Ada data yang belum sesuai. Periksa pesan per kolom" muncul tanpa satu pun
   * pesan per kolom di layar — dan tidak ada cara tahu kolom mana yang salah.
   */
  function pesanError(e: unknown, bawaan: string) {
    if (e instanceof ApiError) {
      const perKolom = e.fields ? Object.values(e.fields) : [];
      return perKolom.length > 0 ? perKolom.join(". ") : e.message;
    }
    return e instanceof Error ? e.message : bawaan;
  }

  async function hapus(url: string, gagal: string) {
    setError(null);
    try {
      await apiFetch(url, { method: "DELETE" });
      loadPrograms();
      if (selected) loadDetail(selected);
    } catch (e) {
      setError(pesanError(e, gagal));
    }
  }

  async function hapusProgram(id: string) {
    setError(null);
    try {
      await apiFetch(`/api/programs/${id}`, { method: "DELETE" });
      if (selected === id) {
        setSelected(null);
        setDepartures([]);
        setPrices([]);
      }
      loadPrograms();
    } catch (e) {
      setError(pesanError(e, "Gagal menghapus program"));
    }
  }

  async function addProgram() {
    setError(null);
    if (!newProgram.quad.trim()) {
      setError("Harga Quad wajib diisi — tanpa harga, program ini tidak bisa dipakai CS saat mencatat closing.");
      return;
    }
    try {
      const program = await apiFetch<{ id: string }>("/api/programs", {
        method: "POST",
        body: JSON.stringify({
          name: newProgram.name,
          destination: newProgram.destination,
          duration_days: newProgram.duration_days,
        }),
      });

      // Harga dibuat menyusul lewat endpoint harga — program dan harga tabel
      // terpisah, jadi tidak ada satu endpoint yang menerima keduanya. Kalau
      // salah satu harga gagal, programnya sudah terlanjur ada; pesannya
      // menyebut itu supaya tidak dikira gagal seluruhnya.
      const hariIni = todayJakarta();
      const hargaBaru = ([["quad", newProgram.quad], ["triple", newProgram.triple], ["double", newProgram.double]] as const)
        .filter(([, nilai]) => nilai.trim() !== "");

      for (const [room_type, nilai] of hargaBaru) {
        await apiFetch(`/api/programs/${program.id}/prices`, {
          method: "POST",
          body: JSON.stringify({ room_type, price: Number(nilai), effective_date: hariIni }),
        });
      }

      setNewProgram({ name: "", destination: "", duration_days: 9, quad: "", triple: "", double: "" });
      loadPrograms();
      loadDetail(program.id);
    } catch (e) {
      setError(pesanError(e, "Gagal menambah program"));
    }
  }

  async function addDeparture() {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/api/programs/${selected}/departures`, { method: "POST", body: JSON.stringify(newDeparture) });
      setNewDeparture({ departure_date: "" });
      loadDetail(selected);
    } catch (e) {
      setError(pesanError(e, "Gagal menambah keberangkatan"));
    }
  }

  async function addPrice() {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/api/programs/${selected}/prices`, { method: "POST", body: JSON.stringify({ ...newPrice, price: Number(newPrice.price) }) });
      setNewPrice({ room_type: "quad", price: "", effective_date: "" });
      loadDetail(selected);
    } catch (e) {
      setError(pesanError(e, "Gagal menambah harga"));
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-bold text-ink-900">Program</h1>
          {/* Badge prototype F-14 — CS ikut mengelola program karena sering
              upsell/cross-sell, jadi CRUD memang terbuka untuk kedua peran. */}
          <span className="rounded-chip bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok">
            Semua role · CS &amp; Owner
          </span>
        </div>
        {error && <Banner variant="danger">{error}</Banner>}
        <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
          {programs.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 pr-2 ${selected === p.id ? "bg-brass-lo" : ""}`}
            >
              <button
                type="button"
                onClick={() => loadDetail(p.id)}
                className="block min-w-0 flex-1 p-3 text-left text-sm"
              >
                <p className="truncate font-medium text-ink-900">{p.name}</p>
                <p className="truncate text-xs text-ink-400">{p.destination} · {p.duration_days} hari</p>
              </button>
              <button
                type="button"
                onClick={() => hapusProgram(p.id)}
                aria-label={`Hapus program ${p.name}`}
                title="Hapus program"
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-ink-400 transition-colors duration-200 hover:bg-danger/10 hover:text-danger"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-[10px] border border-dashed border-line p-3">
          <p className="text-xs font-medium text-ink-600">Tambah program</p>
          <input placeholder="Nama" value={newProgram.name} onChange={(e) => setNewProgram((s) => ({ ...s, name: e.target.value }))} className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
          <input placeholder="Destinasi" value={newProgram.destination} onChange={(e) => setNewProgram((s) => ({ ...s, destination: e.target.value }))} className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
          <input type="number" placeholder="Durasi (hari)" value={newProgram.duration_days} onChange={(e) => setNewProgram((s) => ({ ...s, duration_days: parseInt(e.target.value, 10) || 0 }))} className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
          <div className="mt-1 space-y-2 border-t border-line pt-2">
            <p className="text-xs text-ink-400">Harga per tipe kamar</p>
            <input
              type="number"
              min={1}
              placeholder="Quad (wajib)"
              value={newProgram.quad}
              onChange={(e) => setNewProgram((s) => ({ ...s, quad: e.target.value }))}
              className="h-9 w-full rounded-lg border border-line px-2 font-mono text-sm"
            />
            <input
              type="number"
              min={1}
              placeholder="Triple (opsional)"
              value={newProgram.triple}
              onChange={(e) => setNewProgram((s) => ({ ...s, triple: e.target.value }))}
              className="h-9 w-full rounded-lg border border-line px-2 font-mono text-sm"
            />
            <input
              type="number"
              min={1}
              placeholder="Double (opsional)"
              value={newProgram.double}
              onChange={(e) => setNewProgram((s) => ({ ...s, double: e.target.value }))}
              className="h-9 w-full rounded-lg border border-line px-2 font-mono text-sm"
            />
            <p className="text-[11px] text-ink-400">
              Berlaku mulai hari ini. Triple dan double bisa ditambahkan belakangan.
            </p>
          </div>
          <button type="button" onClick={addProgram} className="h-9 w-full rounded-lg bg-brass text-sm font-semibold text-on-brass">
            Tambah
          </button>
        </div>
      </div>

      {selected && (
        <div className="space-y-4">
          <section className="rounded-[10px] border border-line bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-600">Keberangkatan</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {departures.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-ink-900">{formatDateID(d.departure_date)}</span>
                  <button
                    type="button"
                    onClick={() => hapus(`/api/programs/${selected}/departures/${d.id}`, "Gagal menghapus keberangkatan")}
                    aria-label={`Hapus keberangkatan ${formatDateID(d.departure_date)}`}
                    className="rounded-lg px-2 text-ink-400 transition-colors duration-200 hover:bg-danger/10 hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {departures.length === 0 && (
                <li className="text-ink-400">Belum ada keberangkatan.</li>
              )}
            </ul>
            <div className="flex gap-2">
              <input type="date" value={newDeparture.departure_date} onChange={(e) => setNewDeparture({ departure_date: e.target.value })} className="h-9 rounded-lg border border-line px-2 text-sm" />
              <button type="button" onClick={addDeparture} className="h-9 rounded-lg border border-line px-3 text-sm font-medium">
                Tambah
              </button>
            </div>
          </section>

          <section className="rounded-[10px] border border-line bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink-600">Harga per tipe kamar</h2>
            {/* Grouped by room_type, newest first per group — prototype shows
                the current price up top per room type, then a dated history
                underneath it (not one flat list mixing every room type). */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              {ROOM_TYPES.map((rt) => {
                const roomPrices = prices
                  .filter((p) => p.room_type === rt)
                  .sort((a, b) => b.effective_date.localeCompare(a.effective_date));
                const current = roomPrices[0];
                return (
                  <div key={rt} className="rounded-lg border border-line p-2 text-center">
                    <p className="text-xs capitalize text-ink-400">{rt}</p>
                    <p className="font-mono text-sm font-semibold text-ink-900">
                      {current ? formatRupiah(current.price) : "-"}
                    </p>
                  </div>
                );
              })}
            </div>
            {prices.length > 0 && (
              <div className="mb-3 space-y-3">
                {ROOM_TYPES.filter((rt) => prices.some((p) => p.room_type === rt)).map((rt) => (
                  <div key={rt}>
                    <p className="mb-1 text-xs font-medium capitalize text-ink-600">Riwayat harga ({rt})</p>
                    <ul className="space-y-1 text-sm">
                      {prices
                        .filter((p) => p.room_type === rt)
                        .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
                        .map((p) => (
                          <li key={p.id} className="flex justify-between font-mono text-ink-900">
                            <span>{formatDateID(p.effective_date)}</span>
                            <span>{formatRupiah(p.price)}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {/* Riwayat harga. Komentar di atas menyebut prototype menampilkan
                riwayat bertanggal di bawah kartu, tapi belum pernah dibuat —
                akibatnya harga yang salah ketik tidak punya jalan dihapus, dan
                kartu di atas hanya menampilkan yang terbaru sehingga baris lama
                tak terlihat sama sekali. */}
            {prices.length > 0 && (
              <ul className="mb-4 divide-y divide-line border-t border-line text-sm">
                {[...prices]
                  .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
                  .map((pr) => (
                    <li key={pr.id} className="flex items-center gap-3 py-2">
                      <span className="w-16 shrink-0 capitalize text-ink-600">{pr.room_type}</span>
                      <span className="flex-1 font-mono text-ink-900">{formatRupiah(pr.price)}</span>
                      <span className="font-mono text-xs text-ink-400">
                        mulai {formatDateID(pr.effective_date)}
                      </span>
                      <button
                        type="button"
                        onClick={() => hapus(`/api/programs/${selected}/prices/${pr.id}`, "Gagal menghapus harga")}
                        aria-label={`Hapus harga ${pr.room_type}`}
                        className="rounded-lg px-2 text-ink-400 transition-colors duration-200 hover:bg-danger/10 hover:text-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <select value={newPrice.room_type} onChange={(e) => setNewPrice((s) => ({ ...s, room_type: e.target.value }))} className="h-9 rounded-lg border border-line px-2 text-sm">
                {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="number" min={1} placeholder="Harga" value={newPrice.price} onChange={(e) => setNewPrice((s) => ({ ...s, price: e.target.value }))} className="h-9 rounded-lg border border-line px-2 font-mono text-sm" />
              <input type="date" value={newPrice.effective_date} onChange={(e) => setNewPrice((s) => ({ ...s, effective_date: e.target.value }))} className="h-9 rounded-lg border border-line px-2 text-sm" />
              <button type="button" onClick={addPrice} className="h-9 rounded-lg border border-line px-3 text-sm font-medium">
                Tambah
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
