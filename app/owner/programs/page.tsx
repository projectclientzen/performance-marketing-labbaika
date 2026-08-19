"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { formatRupiah } from "@/lib/utils/rupiah";
import { formatDateID } from "@/lib/utils/date";
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
interface CostRow {
  id: string;
  program_id: string;
  room_type: string;
  cost_price: number;
  effective_date: string;
}

const ROOM_TYPES = ["quad", "triple", "double", "child", "infant"];

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newProgram, setNewProgram] = useState({ name: "", destination: "", duration_days: 9 });
  const [newDeparture, setNewDeparture] = useState({ departure_date: "" });
  const [newPrice, setNewPrice] = useState({ room_type: "quad", price: 0, effective_date: "" });
  const [newCost, setNewCost] = useState({ room_type: "quad", cost_price: 0, effective_date: "" });

  function loadPrograms() {
    apiFetch<Program[]>("/api/programs").then(setPrograms);
  }
  useEffect(loadPrograms, []);

  function loadDetail(programId: string) {
    setSelected(programId);
    apiFetch<Departure[]>(`/api/programs/${programId}/departures`).then(setDepartures);
    apiFetch<PriceRow[]>(`/api/programs/${programId}/prices`).then(setPrices);
    apiFetch<CostRow[]>(`/api/programs/${programId}/costs`).then(setCosts).catch(() => setCosts([]));
  }

  async function addProgram() {
    setError(null);
    try {
      await apiFetch("/api/programs", { method: "POST", body: JSON.stringify(newProgram) });
      setNewProgram({ name: "", destination: "", duration_days: 9 });
      loadPrograms();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah program");
    }
  }

  async function addDeparture() {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/api/programs/${selected}/departures`, { method: "POST", body: JSON.stringify(newDeparture) });
      loadDetail(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah keberangkatan");
    }
  }

  async function addPrice() {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/api/programs/${selected}/prices`, { method: "POST", body: JSON.stringify(newPrice) });
      loadDetail(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah harga");
    }
  }

  async function addCost() {
    if (!selected) return;
    setError(null);
    try {
      await apiFetch(`/api/programs/${selected}/costs`, { method: "POST", body: JSON.stringify(newCost) });
      loadDetail(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah HPP");
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <h1 className="font-display text-xl font-bold text-ink-900">Program</h1>
        {error && <Banner variant="danger">{error}</Banner>}
        <div className="divide-y divide-line rounded-[10px] border border-line bg-card">
          {programs.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadDetail(p.id)}
              className={`block w-full p-3 text-left text-sm ${selected === p.id ? "bg-brass-lo" : ""}`}
            >
              <p className="font-medium text-ink-900">{p.name}</p>
              <p className="text-xs text-ink-400">{p.destination} · {p.duration_days} hari</p>
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-[10px] border border-dashed border-line p-3">
          <p className="text-xs font-medium text-ink-600">Tambah program</p>
          <input placeholder="Nama" value={newProgram.name} onChange={(e) => setNewProgram((s) => ({ ...s, name: e.target.value }))} className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
          <input placeholder="Destinasi" value={newProgram.destination} onChange={(e) => setNewProgram((s) => ({ ...s, destination: e.target.value }))} className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
          <input type="number" placeholder="Durasi (hari)" value={newProgram.duration_days} onChange={(e) => setNewProgram((s) => ({ ...s, duration_days: parseInt(e.target.value, 10) || 0 }))} className="h-9 w-full rounded-lg border border-line px-2 text-sm" />
          <button type="button" onClick={addProgram} className="h-9 w-full rounded-lg bg-brass text-sm font-semibold text-navy-900">
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
                <li key={d.id} className="font-mono text-ink-900">{formatDateID(d.departure_date)}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input type="date" value={newDeparture.departure_date} onChange={(e) => setNewDeparture({ departure_date: e.target.value })} className="h-9 rounded-lg border border-line px-2 text-sm" />
              <button type="button" onClick={addDeparture} className="h-9 rounded-lg border border-line px-3 text-sm font-medium">
                Tambah
              </button>
            </div>
          </section>

          <section className="rounded-[10px] border border-line bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-600">Riwayat harga</h2>
            <ul className="mb-3 space-y-1 text-sm">
              {prices.map((p) => (
                <li key={p.id} className="flex justify-between font-mono text-ink-900">
                  <span>{p.room_type} — sejak {formatDateID(p.effective_date)}</span>
                  <span>{formatRupiah(p.price)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <select value={newPrice.room_type} onChange={(e) => setNewPrice((s) => ({ ...s, room_type: e.target.value }))} className="h-9 rounded-lg border border-line px-2 text-sm">
                {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="number" placeholder="Harga" value={newPrice.price} onChange={(e) => setNewPrice((s) => ({ ...s, price: parseInt(e.target.value, 10) || 0 }))} className="h-9 rounded-lg border border-line px-2 text-sm" />
              <input type="date" value={newPrice.effective_date} onChange={(e) => setNewPrice((s) => ({ ...s, effective_date: e.target.value }))} className="h-9 rounded-lg border border-line px-2 text-sm" />
              <button type="button" onClick={addPrice} className="h-9 rounded-lg border border-line px-3 text-sm font-medium">
                Tambah
              </button>
            </div>
          </section>

          <section className="rounded-[10px] border border-danger/30 bg-danger/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-danger">HPP (Owner-only)</h2>
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                Tidak terlihat CS
              </span>
            </div>
            <ul className="mb-3 space-y-1 text-sm">
              {costs.map((c) => (
                <li key={c.id} className="flex justify-between font-mono text-ink-900">
                  <span>{c.room_type} — sejak {formatDateID(c.effective_date)}</span>
                  <span>{formatRupiah(c.cost_price)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <select value={newCost.room_type} onChange={(e) => setNewCost((s) => ({ ...s, room_type: e.target.value }))} className="h-9 rounded-lg border border-line px-2 text-sm">
                {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="number" placeholder="HPP" value={newCost.cost_price} onChange={(e) => setNewCost((s) => ({ ...s, cost_price: parseInt(e.target.value, 10) || 0 }))} className="h-9 rounded-lg border border-line px-2 text-sm" />
              <input type="date" value={newCost.effective_date} onChange={(e) => setNewCost((s) => ({ ...s, effective_date: e.target.value }))} className="h-9 rounded-lg border border-line px-2 text-sm" />
              <button type="button" onClick={addCost} className="h-9 rounded-lg border border-danger/40 px-3 text-sm font-medium text-danger">
                Tambah
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
