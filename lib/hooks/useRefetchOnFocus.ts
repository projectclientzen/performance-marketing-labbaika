"use client";

import { useEffect, useRef } from "react";

/**
 * Memanggil `fn` setiap kali tab kembali difokuskan atau menjadi terlihat.
 *
 * Dipakai untuk menyegarkan data yang jarang berubah (mis. katalog program)
 * tanpa polling maupun websocket: datanya selalu segar saat pengguna membuka
 * atau kembali ke halaman, dan nol beban server saat halaman diam. Pilihan
 * yang tepat ketika perubahan langka — program cuma ditambah 2-3x sebulan.
 */
export function useRefetchOnFocus(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    const onFocus = () => ref.current();
    const onVisible = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
