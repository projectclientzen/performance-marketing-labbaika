"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

/**
 * Tombol keluar. Sampai sekarang tidak ada jalan logout di UI mana pun —
 * sesi hanya bisa berakhir dengan kedaluwarsa. DELETE /api/auth/session
 * memanggil signOut, lalu diarahkan ke /login.
 */
export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await apiFetch("/api/auth/session", { method: "DELETE" });
    } catch {
      // Walau gagal di server, tetap arahkan ke login — cookie lokal
      // sudah tidak berguna untuk pengguna.
    }
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className={className ?? "text-sm font-medium text-danger disabled:opacity-50"}
    >
      {loading ? "Keluar..." : "Keluar"}
    </button>
  );
}
