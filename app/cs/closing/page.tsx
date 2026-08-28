"use client";

import { useEffect, useState } from "react";
import { useRefetchOnFocus } from "@/lib/hooks/useRefetchOnFocus";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api/client";
import { formatDateID, todayJakarta } from "@/lib/utils/date";
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
  return_date: string | null;
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

// F-05: 4 steps, matching the prototype's sidebar (desktop) / progress bar
// (mobile) exactly. Every field that existed in the old single-page form is
// still here, just grouped under the step it already belonged to (the four
// <section> groups mapped 1:1 onto the prototype's step names).
const STEPS = ["Customer", "Lead", "Paket", "Lokasi & review"] as const;

// Maps a server VALIDATION_ERROR field name back to the step that owns it,
// so a rejection on a field from an earlier step doesn't strand the cs on
// step 4 with an error that points at nothing visible (Opus's review of
// this file, 20 Agustus 2026).
const FIELD_STEP: Record<string, number> = {
  first_name: 0,
  last_name: 0,
  whatsapp: 0,
  email: 0,
  pdp_consent: 0,
  pdp_consent_at: 0,
  lead_date: 1,
  source_id: 1,
  previous_stage: 1,
  program_id: 2,
  departure_id: 2,
  room_type: 2,
  pax: 2,
  price_at_transaction: 2,
  total_value: 2,
  price_note: 2,
  payment_status: 2,
  paid_amount: 2,
  is_price_override: 2,
  province_id: 3,
  city_id: 3,
  closing_date: 3,
};

const inputClass = "mt-1.5 h-[46px] w-full rounded-lg border border-line px-3 text-[15px]";
const labelClass = "text-[13px] text-ink-600";

export default function ClosingFormPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [priceOverride, setPriceOverride] = useState(false);
  // true kalau harga otomatis tidak ketemu untuk kombinasi ini — dipakai untuk
  // menjelaskan kenapa form terpaksa pindah ke input manual (bukan diam-diam).
  const [priceAutoFailed, setPriceAutoFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    loadPrograms();
    apiFetch<Region[]>("/api/master/regions").then(setRegions);
  }, []);

  // Program baru dari CS/owner lain muncul di dropdown saat tab difokuskan.
  function loadPrograms() {
    apiFetch<Program[]>("/api/programs").then((d) => {
      setPrograms(d);
      setForm((f) => (f.program_id || d.length === 0 ? f : { ...f, program_id: d[0].id }));
    });
  }
  // Muat keberangkatan sebuah program. `keepSelection` dipakai saat menyegarkan
  // on-focus: pilihan CS dipertahankan kalau masih valid, hanya jatuh ke
  // keberangkatan pertama (atau "") kalau tidak ada / tidak lagi ada.
  function loadDepartures(programId: string, keepSelection = false) {
    apiFetch<Departure[]>(`/api/programs/${programId}/departures`).then((d) => {
      setDepartures(d);
      setForm((f) => {
        const stillValid = keepSelection && d.some((x) => x.id === f.departure_id);
        return { ...f, departure_id: stillValid ? f.departure_id : d.length > 0 ? d[0].id : "" };
      });
    });
  }

  // Keberangkatan yang baru ditambah di Program & Harga (tab lain) ikut muncul
  // saat kembali ke form ini — bukan cuma daftar programnya. Tanpa ini, CS yang
  // menambah keberangkatan lalu kembali tetap melihat dropdown kosong.
  useRefetchOnFocus(() => {
    loadPrograms();
    if (form.program_id) loadDepartures(form.program_id, true);
  });

  useEffect(() => {
    if (!form.program_id) return;
    // Ganti program → reset ke keberangkatan pertama program baru (atau ""
    // kalau belum ada), supaya departure_id program sebelumnya tidak lolos.
    loadDepartures(form.program_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setPriceAutoFailed(false);
        setForm((f) => ({
          ...f,
          price_at_transaction: p.price,
          total_value: p.price * f.pax,
        }));
      })
      .catch(() => {
        setPriceAutoFailed(true);
        setPriceOverride(true);
      });
  }, [form.program_id, form.departure_id, form.room_type, form.closing_date, form.pax, priceOverride]);

  const provinces = regions.filter((r) => r.level === "province");
  const cities = regions.filter((r) => r.level === "city" && r.parent_id === form.province_id);
  const selectedProgram = programs.find((p) => p.id === form.program_id);

  // Navigation gate only -- which fields must be filled to move forward.
  // Not a validation rule: the real rules stay in closingSchema and the
  // database, and the final submit still validates the whole payload as-is
  // regardless of how the cs got here.
  const stepIncomplete = [
    !form.first_name || !form.whatsapp,
    !form.source_id,
    !form.program_id || !form.departure_id,
    false,
  ][step];

  function goStep(next: number) {
    setFieldErrors({});
    setError(null);
    setStep(next);
  }

  async function submit(force = false) {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
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
      } else if (e instanceof ApiError && e.code === "VALIDATION_ERROR" && e.fields) {
        setFieldErrors(e.fields);
        const offendingSteps = Object.keys(e.fields).map((k) => FIELD_STEP[k] ?? step);
        setStep(Math.min(...offendingSteps, step));
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Gagal menyimpan");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-6 lg:grid lg:grid-cols-[280px_1fr] lg:gap-8 lg:p-8 lg:pb-8">
      {/* Rail langkah vertikal — desktop saja (prototype F-05 desktop: kolom
          280px). Mobile pakai header + progress bar horizontal di bawah. */}
      <aside className="hidden lg:block">
        <h1 className="mb-5 font-display text-xl font-bold text-ink-900">Catat closing</h1>
        <ol className="space-y-1">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  current ? "bg-brass-lo font-semibold text-ink-900" : "text-ink-600"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done || current ? "bg-brass text-on-brass" : "bg-line text-ink-600"
                  }`}
                >
                  {i + 1}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
        <Link href="/cs/closing/riwayat" className="mt-4 inline-block px-3 text-sm font-medium text-ink-600">
          Riwayat closing
        </Link>
      </aside>

      <header className="border-b border-line bg-card px-[18px] py-3.5 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? router.push("/cs") : goStep(step - 1))}
            aria-label="Kembali"
            className="text-[22px] text-ink-600"
          >
            ‹
          </button>
          <h1 className="flex-1 font-display text-[17px] font-semibold text-ink-900">Catat closing</h1>
          {step === 0 && (
            <Link href="/cs/closing/riwayat" className="text-sm font-medium text-ink-600">
              Riwayat
            </Link>
          )}
        </div>
        <div className="mt-3.5 flex gap-2">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brass" : "bg-line"}`} />
          ))}
        </div>
        <p className="mt-2 font-mono text-xs text-ink-400">
          Langkah {step + 1} dari {STEPS.length} · {STEPS[step]}
        </p>
      </header>

      <div className="space-y-5 p-4 lg:p-0">
        {error && <Banner variant="danger">{error}</Banner>}

        {conflict && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6">
            <div className="w-full max-w-sm rounded-[14px] bg-paper p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger-lo text-[22px] text-warn">
                !
              </div>
              <h2 className="font-display text-[19px] font-semibold text-ink-900">Nomor sudah dicatat</h2>
              <p className="mt-2.5 text-sm leading-normal text-ink-600">
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

        {step === 0 && (
          <section className="space-y-3.5 rounded-[10px] border border-line bg-card p-4">
            <div>
              <label className={labelClass}>Nama depan</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                className={inputClass}
              />
              {fieldErrors.first_name && <p className="mt-1 text-xs text-danger">{fieldErrors.first_name}</p>}
            </div>
            <div>
              <label className={labelClass}>Nama belakang</label>
              <input
                placeholder="(opsional)"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input
                placeholder="08..."
                inputMode="numeric"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                className={inputClass}
              />
              {fieldErrors.whatsapp && <p className="mt-1 text-xs text-danger">{fieldErrors.whatsapp}</p>}
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                placeholder="(opsional)"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-danger">{fieldErrors.email}</p>}
            </div>
            {/* Row consent dibungkus card (prototype F-05): pad12 radius8
                border-line bg-card, teks 13px. Teks "pemasaran" sengaja
                dipertahankan (bukan "pemberangkatan" seperti mock) — keputusan
                Maszen: data closing di-upload ke Meta LTV untuk marketing,
                jadi scope consent-nya memang pemasaran. */}
            <label className="flex items-center gap-2 rounded-lg border border-line bg-card p-3 text-[13px] text-ink-600">
              <input
                type="checkbox"
                checked={form.pdp_consent}
                onChange={(e) => setForm((f) => ({ ...f, pdp_consent: e.target.checked }))}
              />
              Jamaah setuju datanya dipakai untuk keperluan pemasaran (PDP)
            </label>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-3.5 rounded-[10px] border border-line bg-card p-4">
            <div>
              <label className={labelClass}>Tanggal lead</label>
              <input
                type="date"
                value={form.lead_date}
                onChange={(e) => setForm((f) => ({ ...f, lead_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sumber lead</label>
              <select
                value={form.source_id}
                onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
                className={inputClass}
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sebelum closing, lead ini ada di stage mana?</label>
              <select
                value={form.previous_stage}
                onChange={(e) => setForm((f) => ({ ...f, previous_stage: e.target.value as typeof f.previous_stage }))}
                className={inputClass}
              >
                <option value="cold">Cold</option>
                <option value="consultation">Consultation</option>
                <option value="offering">Offering</option>
              </select>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3.5 rounded-[10px] border border-line bg-card p-4">
            <div>
              <label className={labelClass}>Program</label>
              <select
                value={form.program_id}
                onChange={(e) => setForm((f) => ({ ...f, program_id: e.target.value }))}
                className={inputClass}
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Keberangkatan</label>
              <select
                value={form.departure_id}
                onChange={(e) => setForm((f) => ({ ...f, departure_id: e.target.value }))}
                className={inputClass}
                disabled={departures.length === 0}
              >
                {departures.length === 0 ? (
                  <option value="">Belum ada keberangkatan</option>
                ) : (
                  departures.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatDateID(d.departure_date)}
                      {d.return_date ? ` – ${formatDateID(d.return_date)}` : ""}
                    </option>
                  ))
                )}
              </select>
              {form.program_id && departures.length === 0 && (
                <p className="mt-1.5 text-[13px] text-warn-ink">
                  Program ini belum punya tanggal keberangkatan. Tambahkan dulu di{" "}
                  <Link href="/owner/programs" className="font-medium text-blue underline">
                    Program &amp; Harga
                  </Link>
                  , lalu buka lagi form ini.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Tipe kamar</label>
              <select
                value={form.room_type}
                onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value }))}
                className={inputClass}
              >
                {ROOM_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Jumlah pax</label>
              <input
                type="number"
                min={1}
                value={form.pax}
                onChange={(e) => {
                  const pax = parseInt(e.target.value, 10) || 1;
                  setForm((f) => ({ ...f, pax, total_value: f.price_at_transaction * pax }));
                }}
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={priceOverride}
                onChange={(e) => {
                  setPriceOverride(e.target.checked);
                  if (!e.target.checked) setPriceAutoFailed(false);
                }}
              />
              Harga khusus (isi manual)
            </label>

            {priceAutoFailed && (
              <p className="rounded-lg bg-warn/10 px-3 py-2 text-[13px] text-warn-ink">
                Harga otomatis tidak ditemukan untuk kombinasi program, keberangkatan,
                tipe kamar, dan tanggal ini. Isi harga manual, atau set harganya dulu di
                Program &amp; Harga.
              </p>
            )}

            {priceOverride ? (
              <>
                <div>
                  <label className={labelClass}>Harga per pax</label>
                  <input
                    type="number"
                    value={form.price_at_transaction}
                    onChange={(e) => {
                      const price = parseInt(e.target.value, 10) || 0;
                      setForm((f) => ({ ...f, price_at_transaction: price, total_value: price * f.pax }));
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Catatan harga khusus</label>
                  <input
                    value={form.price_note}
                    onChange={(e) => setForm((f) => ({ ...f, price_note: e.target.value }))}
                    className={inputClass}
                  />
                  {fieldErrors.price_note && <p className="mt-1 text-xs text-danger">{fieldErrors.price_note}</p>}
                </div>
              </>
            ) : null}

            <p className="font-mono text-2xl font-semibold text-ink-900">{formatRupiah(form.total_value)}</p>

            <div>
              <label className={labelClass}>Status pembayaran</label>
              <select
                value={form.payment_status}
                onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value as typeof f.payment_status }))}
                className={inputClass}
              >
                <option value="dp">DP</option>
                <option value="partial">Cicilan</option>
                <option value="lunas">Lunas</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Jumlah dibayar</label>
              <input
                type="number"
                value={form.paid_amount}
                onChange={(e) => setForm((f) => ({ ...f, paid_amount: parseInt(e.target.value, 10) || 0 }))}
                className={inputClass}
              />
              {fieldErrors.paid_amount && <p className="mt-1 text-xs text-danger">{fieldErrors.paid_amount}</p>}
            </div>
          </section>
        )}

        {step === 3 && (
          <>
            <section className="space-y-3.5 rounded-[10px] border border-line bg-card p-4">
              <div>
                <label className={labelClass}>Provinsi</label>
                <select
                  value={form.province_id}
                  onChange={(e) => setForm((f) => ({ ...f, province_id: e.target.value, city_id: "" }))}
                  className={inputClass}
                >
                  <option value="">Pilih provinsi</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Kota</label>
                <select
                  value={form.city_id}
                  onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Pilih kota</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tanggal closing</label>
                <input
                  type="date"
                  value={form.closing_date}
                  onChange={(e) => setForm((f) => ({ ...f, closing_date: e.target.value }))}
                  className={inputClass}
                />
                {fieldErrors.closing_date && <p className="mt-1 text-xs text-danger">{fieldErrors.closing_date}</p>}
              </div>
            </section>

            <section className="rounded-[10px] border border-line bg-card p-4">
              <h2 className="mb-3 text-[13px] font-semibold text-ink-900">Ringkasan</h2>
              {[
                ["Nama", `${form.first_name} ${form.last_name}`.trim()],
                ["WhatsApp", form.whatsapp],
                ["Program", selectedProgram?.name ?? "-"],
                ["Pax", String(form.pax)],
                ["Total", formatRupiah(form.total_value)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-paper py-1.5 text-[13px] last:border-0">
                  <span className="text-ink-400">{label}</span>
                  <span className="font-mono text-ink-900">{value}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => goStep(step + 1)}
            disabled={stepIncomplete}
            className="h-[50px] w-full rounded-lg bg-brass text-[15px] font-semibold text-on-brass disabled:opacity-50"
          >
            Lanjut
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={submitting}
            className="h-[50px] w-full rounded-lg bg-brass text-[15px] font-semibold text-on-brass disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan closing"}
          </button>
        )}
      </div>
    </div>
  );
}
