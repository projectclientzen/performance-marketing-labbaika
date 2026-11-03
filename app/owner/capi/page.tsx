'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { formatRupiah } from '@/lib/utils/rupiah';

type Mode = 'off' | 'dry_run' | 'test' | 'live';
interface Settings { settings: { mode: Mode; dataset_id: string | null }; readiness: { configured: boolean; test: boolean; live: boolean } }
interface EventRow { id: string; closing_id: string; mode: Mode; status: string; value_snapshot: number; event_time: string; attempt_count: number; last_error: string | null }
interface EventPage { events: EventRow[]; total: number; page: number }
const modeLabels: Record<Mode, string> = { off: 'Nonaktif', dry_run: 'Simulasi tanpa pengiriman', test: 'Uji koneksi Meta', live: 'Pengiriman produksi' };
const statusLabels: Record<string, string> = { pending: 'Dalam antrean', processing: 'Sedang dikirim', accepted: 'Diterima Meta', failed: 'Menunggu coba ulang', held: 'Perlu diperiksa', cancelled: 'Dihentikan' };
const reasonLabels: Record<string, string> = { settings_changed: 'Pengaturan berubah', booking_ineligible: 'Booking tidak memenuhi syarat', snapshot_changed: 'Identitas atau data transaksi berubah', preflight_ineligible: 'Periksa kelayakan dan pengaturan', eligibility_failed: 'Data belum memenuhi syarat', delivery_unknown: 'Hasil kirim belum pasti; jangan kirim ulang', lease_expired_delivery_unknown: 'Proses terhenti; hasil perlu diperiksa', rate_limited: 'Batas permintaan Meta', meta_rejected: 'Meta menolak event', mode_not_configured: 'Konfigurasi server belum lengkap' };

export default function CapiPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<Mode>('off');
  const [dataset, setDataset] = useState('');
  const [events, setEvents] = useState<EventPage>({ events: [], total: 0, page: 0 });
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [s, e] = await Promise.all([apiFetch<Settings>('/api/capi/settings'), apiFetch<EventPage>(`/api/capi/events?page=${page}`)]);
      setSettings(s); setMode(s.settings.mode); setDataset(s.settings.dataset_id ?? ''); setEvents(e);
    } catch (e) { setError(e instanceof Error ? e.message : 'Integrasi belum tersedia.'); }
    finally { setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    setSaving(true); setError('');
    try { await apiFetch('/api/capi/settings', { method: 'PATCH', body: JSON.stringify({ mode, dataset_id: dataset.trim() || null }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Belum tersimpan.'); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-ink-600">Integrasi pemasaran</p><h1 className="mt-2 font-display text-3xl text-ink-900">Purchase dari booking</h1><p className="mt-2 max-w-2xl text-sm text-ink-600">DP pertama memicu satu Purchase senilai total booking. Cicilan dan pelunasan tidak menambah Purchase.</p></div><button onClick={() => void load()} disabled={loading} className="rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-50">Segarkan</button></div>
    {error && <p role="alert" className="rounded-lg border border-danger p-4 text-sm text-danger">{error}</p>}
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-xl text-ink-900">Pengaturan pengiriman</h2>
      <p className="mt-2 text-sm text-ink-600">Hanya transaksi baru yang memenuhi syarat sejak aktivasi. Mengubah mode menahan antrean lama; data September tidak otomatis dikirim.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Mode<select value={mode} onChange={e => setMode(e.target.value as Mode)} disabled={!settings || saving} className="mt-2 block w-full rounded-lg border border-line bg-card p-3">{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value} disabled={(value === 'test' && !settings?.readiness.test) || (value === 'live' && !settings?.readiness.live)}>{label}</option>)}</select></label><label className="text-sm">Dataset Meta<input value={dataset} onChange={e => setDataset(e.target.value)} inputMode="numeric" autoComplete="off" disabled={!settings || saving} className="mt-2 block w-full rounded-lg border border-line p-3" placeholder="Diisi setelah diverifikasi Hermes" /></label></div>
      <p className="mt-4 text-sm text-ink-600">{settings?.readiness.configured ? 'Konfigurasi server tersedia. Pastikan mode dan dataset yang dipilih sesuai tujuan pengujian.' : 'Pengiriman belum siap. Hermes perlu memverifikasi API dan konfigurasi server. Simulasi tetap dapat digunakan setelah migrasi.'}</p>
      {mode === 'live' && <p className="mt-3 text-sm font-medium text-danger">Mode produksi akan mengirim data pelanggan yang memenuhi syarat ke Meta.</p>}
      <button onClick={() => void save()} disabled={!settings || saving || loading} className="mt-5 rounded-lg bg-ink-900 px-5 py-3 text-sm text-white disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
    </section>
    <section className="overflow-hidden rounded-xl border border-line bg-card"><div className="p-5"><h2 className="font-display text-xl">Riwayat pengiriman</h2><p className="mt-2 text-sm text-ink-600">Diterima Meta berarti event diterima secara teknis. Atribusi campaign dan hasil optimasi diperiksa secara terpisah.</p></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-line bg-paper"><tr>{['Booking', 'Nilai booking', 'Mode', 'Status', 'Catatan'].map(h => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{events.events.map(e => <tr key={e.id} className="border-b border-line"><td className="px-5 py-4 font-mono text-xs" title={e.closing_id}>{e.closing_id.slice(0, 8)}</td><td className="whitespace-nowrap px-5 py-4">{formatRupiah(e.value_snapshot)}</td><td className="px-5 py-4">{modeLabels[e.mode]}</td><td className="px-5 py-4">{e.mode === 'dry_run' && e.status === 'pending' ? 'Simulasi tersimpan' : statusLabels[e.status] ?? e.status}</td><td className="min-w-48 px-5 py-4 text-ink-600">{e.last_error ? reasonLabels[e.last_error] ?? 'Perlu pemeriksaan integrasi' : '—'}</td></tr>)}</tbody></table></div>
      {!events.events.length && <p className="p-8 text-center text-sm text-ink-600">{loading ? 'Memuat…' : 'Belum ada event pada halaman ini. Booking yang belum memenuhi syarat tidak masuk antrean.'}</p>}
      <div className="flex items-center justify-between p-4 text-sm"><button disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="rounded border border-line px-3 py-2 disabled:opacity-40">Sebelumnya</button><span>{events.total} event · halaman {page + 1}</span><button disabled={(page + 1) * 50 >= events.total || loading} onClick={() => setPage(p => p + 1)} className="rounded border border-line px-3 py-2 disabled:opacity-40">Berikutnya</button></div>
    </section>
  </div>;
}
