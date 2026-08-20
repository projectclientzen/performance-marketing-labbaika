"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api/client";
import { todayJakarta } from "@/lib/utils/date";
import { formatRupiah } from "@/lib/utils/rupiah";
import { Banner } from "@/components/ui/Banner";

interface LeadSource {
  id: string;
  name: string;
}
interface Program {
  id: string;
  name: string;
}
interface Departure {
  id: string;
  departure_date: string;
}
interface PriceRow {
  price: number;
}
interface Region {
  id: string;
  level: "province" | "city";
  name: string;
  parent_id: string | null;
}

const ROOM_TYPES = [
  { value: "quad", label: "Kamar 4" },
  { value: "triple", label: "Kamar 3" },
  { value: "double", label: "Kamar 2" },
  { value: "child", label: "Anak" },
  { value: "infant", label: "Bayi" },
];

interface DuplicateConflict {
  cs_name: string;
  closing_date: string;
  program_name: string;
}

export default function ClosingFormPage() {
  const router = useRouter();
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [priceOverride, setPriceOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DuplicateConflict | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    whatsapp: "",
    email: "",
    pdp_consent: false,
    source_id: "",
    lead_date: todayJakarta(),
    previous_stage: "offering" as "cold" | "consultation" | "offering",
    program_id: "",
    departure_id: "",
    room_type: "quad",
    pax: 1,
    price_at_transaction: 0,
    total_value: 0,
    price_note: "",
    payment_status: "dp" as "dp" | "partial" | "lunas" | "refunded",
    paid_amount: 0,
    province_id: "",
    city_id: "",
    closing_date: todayJakarta(),
  });

  useEffect(() => {
    apiFetch<LeadSource[]>("/api/master/sources").then((d) => {
      setSources(d);
      if (d.length > 0) setForm((f) => ({ ...f, source_id: d[0].id }));
    });
    apiFetch<Program[]>("/api/programs").then((d) => {
      setPrograms(d);
      if (d.length > 0) setForm((f) => ({ ...f, program_id: d[0].id }));
    });
    apiFetch<Region[]>("/api/master/regions").then(setRegions);
  }, []);

  useEffect(() => {
    if (!form.program_id) return;
    apiFetch<Departure[]>(`/api/programs/${form.program_id}/departures`).then((d) => {
      setDepartures(d);
      if (d.length > 0) setForm((f) => ({ ...f, departure_id: d[0].id }));
    });
  }, [form.program_id]);

  useEffect(() => {
    if (priceOverride || !form.program_id || !form.departure_id || !form.room_type) return;
    const params = new URLSearchParams({
      program_id: form.program_id,
      departure_id: form.departure_id,
      room_type: form.room_type,
      date: form.closing_date,
    });
    apiFetch<PriceRow>(`/api/price-lookup?${params}`)
      .then((p) => {
        setForm((f) => ({
          ...f,
          price_at_transaction: p.price,
          total_value: p.price * f.pax,
        }));
      })
      .catch(() => setPriceOverride(true));
  }, [form.program_id, form.departure_id, form.room_type, form.closing_date, form.pax, priceOverride]);

  const provinces = regions.filter((r) => r.level === "province");
  const cities = regions.filter((r) => r.level === "city" && r.parent_id === form.province_id);

  async function submit(force = false) {
    setSubmitting(true);
    setError(null);
    setConflict(null);
    try {
      const data = await apiFetch<{ id: string }>("/api/closings", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          pdp_consent_at: form.pdp_consent ? new Date().toISOString() : undefined,
          is_price_override: priceOverride,
          force,
        }),
      });
      if (data) router.push("/cs");
    } catch (e) {
      // POST /api/closings returns code DUPLICATE_CONFLICT + fields
      // {cs_name, closing_date, program_name} on 409 (see ApiError in
      // lib/api/client.ts).
      if (e instanceof ApiError && e.code === "DUPLICATE_CONFLICT" && e.fields) {
        setConflict(e.fields as unknown as DuplicateConflict);
      } else {
        setError(e instanceof Error ? e.message : "Gagal menyimpan");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-6">
      <header className="flex items-center gap-3 border-b border-line bg-card px-[18px] py-3.5">
        <button type="button" onClick={() => router.push("/cs")} aria-label="Kembali" className="text-[22px] text-ink-600">
          ‹
        </button>
        <h1 className="font-display text-[17px] font-semibold text-ink-900">Catat closing</h1>
      </header>

      <div className="space-y-5 p-4">
        {error && <Banner variant="danger">{error}</Banner>}

        {conflict && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6">
            <div className="w-full max-w-sm rounded-[14px] bg-paper p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger-lo text-[22px] text-warn">
                !
              </div>
              <h2 className="font-display text-[19px] font-semibold text-ink-900">Nomor sudah dicatat</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-600">
                Nomor ini sudah dicatat closing oleh <b>{conflict.cs_name}</b>, {conflict.closing_date}, {conflict.program_name}.
              </p>
              <div className="mt-[22px] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setConflict(null)}
                  className="h-[50px] rounded-lg border border-line bg-card text-[15px] font-medium text-ink-900"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  className="h-[50px] rounded-lg bg-navy-900 text-sm font-semibold text-white"
                >
                  Tetap simpan, butuh persetujuan Owner
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-600">Customer</h2>
        <input
          placeholder="Nama depan"
          value={form.first_name}
          onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        />
        <input
          placeholder="Nama belakang (opsional)"
          value={form.last_name}
          onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        />
        <input
          placeholder="WhatsApp (08...)"
          inputMode="numeric"
          value={form.whatsapp}
          onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        />
        <input
          placeholder="Email (opsional)"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        />
        <label className="flex items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={form.pdp_consent}
            onChange={(e) => setForm((f) => ({ ...f, pdp_consent: e.target.checked }))}
          />
          Jamaah setuju datanya dipakai untuk keperluan pemasaran (PDP)
        </label>
      </section>

      <section className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-600">Lead</h2>
        <input
          type="date"
          value={form.lead_date}
          onChange={(e) => setForm((f) => ({ ...f, lead_date: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        />
        <select
          value={form.source_id}
          onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div>
          <p className="mb-1 text-xs text-ink-400">Sebelum closing, lead ini ada di stage mana?</p>
          <select
            value={form.previous_stage}
            onChange={(e) => setForm((f) => ({ ...f, previous_stage: e.target.value as typeof f.previous_stage }))}
            className="h-11 w-full rounded-lg border border-line px-3"
          >
            <option value="cold">Cold</option>
            <option value="consultation">Consultation</option>
            <option value="offering">Offering</option>
          </select>
        </div>
      </section>

      <section className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-600">Paket</h2>
        <select
          value={form.program_id}
          onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={form.departure_id}
          onChange={(e) => setForm((f) => ({ ...f, departure_id: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        >
          {departures.map((d) => (
            <option key={d.id} value={d.id}>
              {d.departure_date}
            </option>
          ))}
        </select>
        <select
          value={form.room_type}
          onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        >
          {ROOM_TYPES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          value={form.pax}
          onChange={(e) => {
            const pax = parseInt(e.target.value, 10) || 1;
            setForm((f) => ({ ...f, pax, total_value: f.price_at_transaction * pax }));
          }}
          className="h-11 w-full rounded-lg border border-line px-3"
        />

        <label className="flex items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={priceOverride}
            onChange={(e) => setPriceOverride(e.target.checked)}
          />
          Harga khusus (isi manual)
        </label>

        {priceOverride ? (
          <>
            <input
              type="number"
              placeholder="Harga per pax"
              value={form.price_at_transaction}
              onChange={(e) => {
                const price = parseInt(e.target.value, 10) || 0;
                setForm((f) => ({ ...f, price_at_transaction: price, total_value: price * f.pax }));
              }}
              className="h-11 w-full rounded-lg border border-line px-3"
            />
            <input
              placeholder="Catatan harga khusus"
              value={form.price_note}
              onChange={(e) => setForm((f) => ({ ...f, price_note: e.target.value }))}
              className="h-11 w-full rounded-lg border border-line px-3"
            />
          </>
        ) : null}

        <p className="font-mono text-2xl font-semibold text-ink-900">
          {formatRupiah(form.total_value)}
        </p>

        <select
          value={form.payment_status}
          onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value as typeof f.payment_status }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        >
          <option value="dp">DP</option>
          <option value="partial">Cicilan</option>
          <option value="lunas">Lunas</option>
        </select>
        <input
          type="number"
          placeholder="Jumlah dibayar"
          value={form.paid_amount}
          onChange={(e) => setForm((f) => ({ ...f, paid_amount: parseInt(e.target.value, 10) || 0 }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        />
      </section>

      <section className="space-y-3 rounded-[10px] border border-line bg-card p-4">
        <h2 className="text-sm font-semibold text-ink-600">Lokasi</h2>
        <select
          value={form.province_id}
          onChange={(e) => setForm((f) => ({ ...f, province_id: e.target.value, city_id: "" }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        >
          <option value="">Pilih provinsi</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={form.city_id}
          onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        >
          <option value="">Pilih kota</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.closing_date}
          onChange={(e) => setForm((f) => ({ ...f, closing_date: e.target.value }))}
          className="h-11 w-full rounded-lg border border-line px-3"
        />
      </section>

        <button
          type="button"
          onClick={() => submit(false)}
          disabled={submitting}
          className="h-12 w-full rounded-lg bg-brass text-base font-semibold text-on-brass disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan closing"}
        </button>
      </div>
    </div>
  );
}
