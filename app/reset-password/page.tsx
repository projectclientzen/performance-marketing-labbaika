"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "memeriksa" | "siap" | "tidak-valid" | "selesai";

/**
 * Halaman ganti password — 10-AUDIT-FE-BE.md #26.
 *
 * Sampai sekarang aplikasi tidak punya rute ini sama sekali: Supabase
 * mengirim tautan pemulihan, tapi tidak ada halaman yang menerimanya, jadi
 * middleware melempar semuanya ke /login dan tautannya terlihat "tidak
 * berfungsi". Itu yang bikin akun owner terkunci di luar.
 *
 * Dua bentuk tautan ditangani sekaligus, karena sumbernya bisa berbeda:
 *   - PKCE (dipakai @supabase/ssr)      → mendarat dengan `?code=...`
 *   - Implicit (tautan dari Dashboard)  → token ada di fragment `#access_token`
 * Fragment tidak pernah dikirim ke server, jadi keduanya harus dibaca di
 * browser — itu sebabnya halaman ini client component.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("memeriksa");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function bootstrap() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        // Tautan yang sudah dipakai atau kedaluwarsa tidak menghasilkan sesi —
        // lebih baik bilang begitu daripada menampilkan form yang pasti gagal.
        const { data } = await supabase.auth.getUser();
        setStatus(data.user ? "siap" : "tidak-valid");
      } catch {
        setStatus("tidak-valid");
      } finally {
        // Token dibersihkan dari address bar supaya tidak ikut tersalin atau
        // tercatat di riwayat browser.
        if (window.location.hash || url.searchParams.has("code")) {
          window.history.replaceState({}, "", "/reset-password");
        }
      }
    }

    bootstrap();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak sama");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message || "Gagal mengubah password");
      setSaving(false);
      return;
    }
    setStatus("selesai");
    setSaving(false);
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-[radial-gradient(120%_80%_at_50%_0%,#0E5570_0%,var(--color-navy-900)_60%)] px-7 py-8">
      <h1 className="font-display text-[28px] font-bold tracking-tight text-white">Ganti password</h1>

      {status === "memeriksa" && (
        <p className="mt-1.5 text-sm text-on-dark-muted">Memeriksa tautan...</p>
      )}

      {status === "tidak-valid" && (
        <>
          <p className="mb-7 mt-1.5 text-sm text-on-dark-muted">
            Tautan ini sudah dipakai atau kedaluwarsa. Minta owner membuat tautan baru.
          </p>
          <Link
            href="/login"
            className="flex h-[52px] w-full items-center justify-center rounded-lg bg-brass text-base font-semibold text-on-brass"
          >
            Kembali ke halaman masuk
          </Link>
        </>
      )}

      {status === "selesai" && (
        <>
          <p className="mb-7 mt-1.5 text-sm text-on-dark-muted">
            Password berhasil diubah. Silakan masuk dengan password baru.
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="h-[52px] w-full rounded-lg bg-brass text-base font-semibold text-on-brass"
          >
            Masuk
          </button>
        </>
      )}

      {status === "siap" && (
        <>
          <p className="mb-7 mt-1.5 text-sm text-on-dark-muted">Buat password baru untuk akunmu.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="password" className="text-[13px] text-on-dark">
                Password baru
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-lg border border-navy-700 bg-navy-800 px-3.5 text-base text-white focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="text-[13px] text-on-dark">
                Ulangi password baru
              </label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-lg border border-navy-700 bg-navy-800 px-3.5 text-base text-white focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="h-[52px] w-full rounded-lg bg-brass text-base font-semibold text-on-brass transition-opacity disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan password"}
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-xs text-on-dark-faint">Labbaika Group · v1.1</p>
    </main>
  );
}
