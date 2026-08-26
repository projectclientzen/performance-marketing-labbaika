import { NextResponse } from "next/server";
import { getAuthedAppUser } from "@/lib/auth/session";
import { ok, fail, httpStatus } from "@/lib/api/envelope";

/**
 * Menghapus program. Sebelumnya tidak ada jalan menghapus apa pun di layar
 * Program & Harga, jadi salah ketik atau tekan Tambah dua kali meninggalkan
 * baris yang menetap selamanya — dan program yang sama muncul berkali-kali di
 * pemilih program pada form closing CS.
 *
 * Tidak memakai cascade. Program yang sudah dipakai closing tidak boleh
 * lenyap: angka closing lama akan kehilangan acuannya. Alih-alih menghapus
 * diam-diam atau gagal dengan pesan constraint mentah, pemakaian dihitung
 * lebih dulu dan ditolak dengan kalimat yang menyebut apa yang menahannya.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, appUser, supabase } = await getAuthedAppUser();

  if (!user) {
    return NextResponse.json(fail("UNAUTHORIZED"), { status: httpStatus("UNAUTHORIZED") });
  }
  if (!appUser) {
    return NextResponse.json(fail("FORBIDDEN"), { status: httpStatus("FORBIDDEN") });
  }

  const [closings, departures, prices] = await Promise.all([
    supabase.from("closings").select("id", { count: "exact", head: true }).eq("program_id", id),
    supabase.from("program_departures").select("id", { count: "exact", head: true }).eq("program_id", id),
    supabase.from("program_prices").select("id", { count: "exact", head: true }).eq("program_id", id),
  ]);

  if (closings.count) {
    return NextResponse.json(
      fail(
        "CONFLICT",
        `Program ini dipakai ${closings.count} closing, jadi tidak bisa dihapus. Menghapusnya akan membuat closing lama kehilangan acuan programnya.`,
      ),
      { status: httpStatus("CONFLICT") },
    );
  }

  const penahan = [
    departures.count ? `${departures.count} keberangkatan` : null,
    prices.count ? `${prices.count} harga` : null,
  ].filter(Boolean);

  if (penahan.length > 0) {
    return NextResponse.json(
      fail("CONFLICT", `Hapus ${penahan.join(" dan ")} milik program ini dulu.`),
      { status: httpStatus("CONFLICT") },
    );
  }

  const { error, count } = await supabase
    .from("programs")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    console.error("[api/programs/:id] DELETE", error);
    // CS tidak punya SELECT pada closings (dibaca lewat view), jadi guard
    // penghitung closings di atas melihat 0 untuk mereka dan terlewati. Kalau
    // program sebenarnya masih dipakai closing, delete-nya kena FK RESTRICT di
    // sini — petakan ke pesan yang sama supaya semua peran dapat penjelasan
    // yang benar, bukan 500.
    if (/foreign key|violates|referenced|constraint/i.test(error.message)) {
      return NextResponse.json(
        fail("CONFLICT", "Program ini masih dipakai closing, jadi tidak bisa dihapus."),
        { status: httpStatus("CONFLICT") },
      );
    }
    return NextResponse.json(fail("INTERNAL_ERROR"), { status: httpStatus("INTERNAL_ERROR") });
  }
  if (!count) {
    return NextResponse.json(fail("NOT_FOUND", "Program tidak ditemukan"), {
      status: httpStatus("NOT_FOUND"),
    });
  }

  return NextResponse.json(ok({ id }));
}
