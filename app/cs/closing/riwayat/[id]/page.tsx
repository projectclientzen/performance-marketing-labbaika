"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api/client";
import { formatDateID } from "@/lib/utils/date";
import { jakartaPaymentTimeToIso, isoToJakartaPaymentTime } from "@/lib/utils/payment-time";
import { formatRupiah } from "@/lib/utils/rupiah";
import { Banner } from "@/components/ui/Banner";

// Same v_closings_cs shape as the list page -- no cost/profit columns,
// shown as-is (10-AUDIT-FE-BE.md #12).
interface ClosingRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  closing_date: string;
  program_id: string;
  total_value: number;
  paid_amount: number;
  first_payment_received_at?: string | null;
  price_note: string | null;
  province_id: string | null;
  city_id: string | null;
  address: string | null;
  payment_status: "dp" | "partial" | "lunas" | "refunded" | "cancelled";
}

interface Program {
  id: string;
  name: string;
}

const inputClass = "mt-1.5 h-[46px] w-full rounded-lg border border-line px-3 text-[15px]";
const labelClass = "text-[13px] text-ink-600";
const capiLabels: Record<string, string> = { pending: "Dalam antrean", processing: "Sedang dikirim", accepted: "Diterima Meta", failed: "Menunggu coba ulang", held: "Perlu diperiksa admin", cancelled: "Pengiriman dihentikan" };

export default function ClosingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [closing, setClosing] = useState<ClosingRow | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [capiStatus, setCapiStatus] = useState("Memuat status…");

  const refreshCapiStatus = useCallback(async () => {
    try {
      const { events } = await apiFetch<{ events: { mode: string; status: string }[] }>(`/api/capi/events?closing_id=${encodeURIComponent(id)}`);
      const event = events[0];
      setCapiStatus(event ? `${event.mode === 'dry_run' ? 'Simulasi' : event.mode === 'test' ? 'Uji koneksi' : 'Produksi'} · ${capiLabels[event.status] ?? event.status}` : "Belum masuk antrean; periksa kelayakan dan status integrasi dengan admin.");
    } catch { setCapiStatus("Status integrasi belum tersedia."); }
  }, [id]);

  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<ClosingRow["payment_status"]>("dp");
  const [paidAmount, setPaidAmount] = useState(0);
  const [firstPayment, setFirstPayment] = useState("");
  const [priceNote, setPriceNote] = useState("");

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    void refreshCapiStatus();
    Promise.all([apiFetch<ClosingRow[]>("/api/closings"), apiFetch<Program[]>("/api/programs")])
      .then(([rows, p]) => {
        const found = rows.find((r) => r.id === id) ?? null;
        setClosing(found);
        setPrograms(p);
        if (found) {
          setLastName(found.last_name ?? "");
          setEmail(found.email ?? "");
          setPaymentStatus(found.payment_status === "cancelled" ? "dp" : found.payment_status);
          setPaidAmount(found.paid_amount);
          setFirstPayment(isoToJakartaPaymentTime(found.first_payment_received_at));
          setPriceNote(found.price_note ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [id, refreshCapiStatus]);

  async function saveChanges() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Preserve the original seconds/precision on subsequent installment edits.
      const paymentTime = closing?.first_payment_received_at ?? jakartaPaymentTimeToIso(firstPayment);
      await apiFetch(`/api/closings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          last_name: lastName || undefined,
          email: email || undefined,
          payment_status: paymentStatus,
          paid_amount: paidAmount,
          first_payment_received_at: paymentTime,
          price_note: priceNote || undefined,
        }),
      });
      setClosing(row => row ? { ...row, first_payment_received_at: paymentTime, paid_amount: paidAmount, payment_status: paymentStatus } : row);
      setSaved(true);
      void refreshCapiStatus();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    setError(null);
    try {
      await apiFetch(`/api/closings/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason }),
      });
      router.push("/cs/closing/riwayat");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal membatalkan closing");
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-ink-400">Memuat...</p>
      </div>
    );
  }

  if (!closing) {
    return (
      <div className="p-4">
        <Banner variant="danger">Closing tidak ditemukan.</Banner>
      </div>
    );
  }

  const isCancelled = closing.payment_status === "cancelled";

  return (
    <div className="pb-6">
      <header className="flex items-center gap-3 border-b border-line bg-card px-[18px] py-3.5">
        <button
          type="button"
          onClick={() => router.push("/cs/closing/riwayat")}
          aria-label="Kembali"
          className="text-[22px] text-ink-600"
        >
          ‹
        </button>
        <h1 className="font-display text-[17px] font-semibold text-ink-900">
          {closing.first_name} {closing.last_name}
        </h1>
      </header>

      <div className="space-y-4 p-4">
        {error && <Banner variant="danger">{error}</Banner>}
        {saved && <Banner variant="ok">Perubahan tersimpan</Banner>}
        {isCancelled && <Banner variant="warn">Closing ini sudah dibatalkan, tidak bisa diedit lagi.</Banner>}

        <section className="rounded-[10px] border border-line bg-card p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-ink-900">Ringkasan</h2>
          {[
            ["Program", programs.find((p) => p.id === closing.program_id)?.name ?? "-"],
            ["Tanggal closing", formatDateID(closing.closing_date)],
            ["Total", formatRupiah(closing.total_value)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-paper py-1.5 text-[13px] last:border-0">
              <span className="text-ink-400">{label}</span>
              <span className="font-mono text-ink-900">{value}</span>
            </div>
          ))}
        </section>

        <section className="space-y-3.5 rounded-[10px] border border-line bg-card p-4">
          <div className="rounded-lg bg-paper p-3 text-sm"><p className="font-medium">Purchase Meta</p><p className="mt-1">{capiStatus}</p><p className="mt-1 text-xs text-ink-600">Satu Purchase memakai total nilai booking. Status diterima bukan kepastian atribusi iklan.</p><button type="button" onClick={() => void refreshCapiStatus()} className="mt-2 underline">Segarkan status</button></div>
          <h2 className="text-[13px] font-semibold text-ink-900">Koreksi</h2>
          <div>
            <label className={labelClass}>Nama belakang</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isCancelled}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isCancelled}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Status pembayaran</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as ClosingRow["payment_status"])}
              disabled={isCancelled}
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
              value={paidAmount}
              onChange={(e) => setPaidAmount(parseInt(e.target.value, 10) || 0)}
              disabled={isCancelled}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="first-payment-edit" className={labelClass}>Waktu pembayaran pertama diterima (WIB)</label>
            <input id="first-payment-edit" type="datetime-local" value={firstPayment} onChange={e => setFirstPayment(e.target.value)} disabled={isCancelled || Boolean(closing.first_payment_received_at)} className={inputClass} />
            <p className="mt-2 text-xs text-ink-600">Waktu asli, bukan waktu input ulang. Catatan lama tidak otomatis dikirim ke Meta. Koreksi waktu yang sudah tersimpan ditangani melalui pemeriksaan admin.</p>
          </div>
          <div>
            <label className={labelClass}>Catatan harga</label>
            <input
              value={priceNote}
              onChange={(e) => setPriceNote(e.target.value)}
              disabled={isCancelled}
              className={inputClass}
            />
          </div>

          {!isCancelled && (
            <button
              type="button"
              onClick={saveChanges}
              disabled={saving}
              className="h-12 w-full rounded-lg bg-brass text-base font-semibold text-on-brass disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan perubahan"}
            </button>
          )}
        </section>

        {!isCancelled && !showCancelConfirm && (
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="h-12 w-full rounded-lg border border-danger/40 text-sm font-semibold text-danger"
          >
            Batalkan closing
          </button>
        )}

        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6">
            <div className="w-full max-w-sm rounded-[14px] bg-paper p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-danger-lo text-[22px] text-warn">
                !
              </div>
              <h2 className="font-display text-[19px] font-semibold text-ink-900">Batalkan closing?</h2>
              {/* POST /cancel needs a reason, not a formality -- it reverses
                  T-1's effect on the originating lead_report's bucket. */}
              <p className="mt-2.5 text-sm text-ink-600">Alasan pembatalan wajib diisi.</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: jamaah batal berangkat"
                className="mt-3 h-20 w-full rounded-lg border border-line p-3 text-sm"
              />
              <div className="mt-[22px] flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setCancelReason("");
                  }}
                  className="h-[50px] rounded-lg border border-line bg-card text-[15px] font-medium text-ink-900"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmCancel}
                  disabled={!cancelReason.trim() || cancelling}
                  className="h-[50px] rounded-lg bg-danger text-sm font-semibold text-white disabled:opacity-50"
                >
                  {cancelling ? "Membatalkan..." : "Ya, batalkan closing"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
