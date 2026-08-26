"use client";

import { hasOwnerAccess } from "@/lib/auth/roles";
import { apiFetch, ApiError } from "@/lib/api/client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiFetch("/api/auth/session", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const me = await apiFetch<{ role: string }>("/api/me");
      router.push(hasOwnerAccess(me.role) ? "/owner" : "/cs");
      // loading stays true through the redirect on purpose — the button
      // shouldn't flash back to enabled while the route is still changing.
    } catch (e) {
      // A 500 with an empty/non-JSON body (crashed runtime, gateway
      // timeout) used to throw a raw SyntaxError here, which was never
      // caught — the promise just rejected silently and setLoading(false)
      // never ran, leaving "Memproses..." locked forever with no error
      // shown. apiFetch now always throws ApiError; catch it and any other
      // failure the same way.
      setError(e instanceof ApiError ? e.message : "Gagal masuk");
      setLoading(false);
    }
  }

  return (
    // Prototype F-01 punya dua varian: mobile satu kolom di atas gradient navy,
    // dan desktop split — panel brand (logo 108, tagline 40px, footer mono) di
    // kiri, kartu form 480px putih di kanan. Sampai sekarang kode hanya punya
    // varian mobile, jadi di layar lebar ia terentang tanpa panel brand.
    // Gradient highlight (#0E5570) khusus F-01, bukan token yang dipakai ulang.
    <main className="md:flex md:min-h-screen md:items-center md:justify-center md:bg-ink-900 md:p-8">
      <div className="md:w-full md:max-w-[1120px] md:overflow-hidden md:rounded-[14px] md:border md:border-line md:shadow-2xl">
        <div className="md:grid md:min-h-[600px] md:grid-cols-[1fr_480px]">
          {/* Panel brand — hanya desktop, mock mobile tidak punya ini. */}
          <div className="hidden bg-[radial-gradient(100%_120%_at_0%_0%,#0E5570_0%,var(--color-navy-900)_55%)] p-14 text-white md:flex md:flex-col md:justify-between">
            <div className="flex h-[108px] w-[108px] items-center justify-center self-center overflow-hidden rounded-[26px] bg-card shadow-lg">
              <Image src="/logo/labbaika-full.png" alt="Labbaika" width={108} height={108} className="h-full w-full object-cover" priority />
            </div>
            <p className="max-w-[380px] font-display text-[40px] font-bold leading-[1.05] tracking-[-0.02em]">
              Mudah, Berkah,
              <br />
              Amanah.
            </p>
            <p className="font-mono text-xs text-on-dark-faint">Labbaika Group · v1.1</p>
          </div>

          {/* Kolom form: layar penuh di mobile, kartu putih di desktop. */}
          <div className="flex min-h-screen flex-col justify-center bg-[radial-gradient(120%_80%_at_50%_0%,#0E5570_0%,var(--color-navy-900)_60%)] px-7 py-8 md:min-h-0 md:bg-card md:bg-none md:px-12 md:py-14">
            <div className="mx-auto mb-7 flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-[28px] bg-card shadow-lg md:hidden">
              <Image src="/logo/labbaika-full.png" alt="Labbaika" width={120} height={120} className="h-full w-full object-cover" priority />
            </div>
            <h1 className="font-display text-[28px] font-bold tracking-tight text-white md:text-[26px] md:tracking-[-0.01em] md:text-ink-900">Masuk</h1>
            <p className="mb-7 mt-1.5 text-sm text-on-dark-muted md:text-ink-600">
              Laporan harian Labbaika Group
            </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-[13px] text-on-dark md:text-ink-600">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-lg border border-navy-700 bg-navy-800 px-3.5 text-base text-white focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30 md:border-line md:bg-card md:text-ink-900"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-[13px] text-on-dark md:text-ink-600">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-lg border border-navy-700 bg-navy-800 px-3.5 text-base text-white focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30 md:border-line md:bg-card md:text-ink-900"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {/* 10-AUDIT-FE-BE.md #26: there's no self-serve reset page (no
            SMTP, no reset route) -- a link here would do nothing. Owner
            can generate a one-time reset link from Manajemen user
            (app/owner/settings/users) and relay it directly. */}
        <p className="text-[13px] text-on-dark-muted md:text-ink-600">Lupa password? Hubungi owner untuk reset.</p>

        <button
          type="submit"
          disabled={loading}
          className="h-[52px] w-full rounded-lg bg-brass text-base font-semibold text-on-brass transition-opacity disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
            </form>

            {/* Footer versi: di desktop pindah ke panel brand kiri. */}
            <p className="mt-8 text-center text-xs text-on-dark-faint md:hidden">Labbaika Group · v1.1</p>
          </div>
        </div>
      </div>
    </main>
  );
}
