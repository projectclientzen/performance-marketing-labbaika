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
    <main
      className="flex min-h-screen flex-col justify-center px-7 py-8"
      style={{ background: "radial-gradient(120% 80% at 50% 0%, #0E5570 0%, var(--color-navy-900) 60%)" }}
    >
      {/* Gradient highlight (#0E5570) is F-01-only per prototype, not a
          reusable token — reported to -09, treated as a one-off per her
          go-ahead to stop waiting on single-screen colors. */}
      <div className="mx-auto mb-7 flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-[28px] bg-card shadow-lg">
        <Image src="/logo/labbaika-full.png" alt="Labbaika" width={120} height={120} className="h-full w-full object-cover" priority />
      </div>
      <h1 className="font-display text-[28px] font-bold tracking-tight text-white">Masuk</h1>
      <p className="mb-7 mt-1.5 text-sm text-on-dark-muted">Laporan harian Labbaika Group</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-[13px] text-on-dark">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-lg border border-navy-700 bg-navy-800 px-3.5 text-base text-white focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-[13px] text-on-dark">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-lg border border-navy-700 bg-navy-800 px-3.5 text-base text-white focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <a href="#" className="block text-[13px] text-on-dark-muted">
          Lupa password
        </a>

        <button
          type="submit"
          disabled={loading}
          className="h-[52px] w-full rounded-lg bg-brass text-base font-semibold text-on-brass transition-opacity disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-on-dark-faint">Labbaika Group · v1.1</p>
    </main>
  );
}
