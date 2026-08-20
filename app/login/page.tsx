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
    <main className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div className="w-full max-w-sm rounded-[10px] bg-card p-8 shadow-lg">
        <Image src="/logo/labbaika-full.png" alt="Labbaika" width={140} height={140} className="mx-auto" priority />
        <p className="mt-3 text-center text-sm text-ink-600">Masuk untuk lanjut ke laporan harian</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-line px-3 text-base focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-line px-3 text-base focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-lg bg-brass text-base font-semibold text-navy-900 transition-opacity disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <a href="#" className="mt-4 block text-center text-sm text-blue">
          Lupa password
        </a>
      </div>
    </main>
  );
}
