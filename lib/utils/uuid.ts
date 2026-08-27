/**
 * UUID v4 yang aman di semua browser.
 *
 * `crypto.randomUUID()` baru ada di Safari 15.4+, Chrome 92+, Firefox 95+.
 * Di perangkat/browser lama fungsi itu undefined dan memanggilnya melempar
 * error — kalau dipanggil saat render (mis. useState initializer), seluruh
 * halaman crash dengan "a client-side exception has occurred". Util ini pakai
 * randomUUID bila ada, jatuh ke getRandomValues, lalu terakhir Math.random.
 */
export function uuid(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // versi 4
    b[8] = (b[8] & 0x3f) | 0x80; // varian
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h
      .slice(8, 10)
      .join("")}-${h.slice(10, 16).join("")}`;
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
