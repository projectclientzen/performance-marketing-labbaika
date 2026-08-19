import { describe, expect, it } from 'vitest';
import { csvFromGenerator, csvRowGenerator, toCSV } from './csv';

describe('DS-11 csv', () => {
  it('escaping koma, kutip ganda, baris baru, karakter Indonesia', () => {
    const csv = toCSV(
      ['nama', 'kota', 'catatan'],
      [
        ['Budi', 'Jakarta', 'halo, apa kabar'],
        ['Sari "Si Cantik"', 'Bandung', 'baris\nkedua'],
        ['Ahmad', 'Surabaya', 'ini 100% asli'],
      ],
    );
    expect(csv).toBe(
      [
        'nama,kota,catatan',
        'Budi,Jakarta,"halo, apa kabar"',
        '"Sari ""Si Cantik""",Bandung,"baris\nkedua"',
        'Ahmad,Surabaya,ini 100% asli',
      ].join('\r\n'),
    );
  });

  it('nilai null/undefined jadi sel kosong', () => {
    expect(toCSV(['a', 'b'], [[null, undefined]])).toBe('a,b\r\n,');
  });

  it('BOM opsional', () => {
    expect(toCSV(['a'], [['x']], { bom: true }).charCodeAt(0)).toBe(0xfeff);
    expect(toCSV(['a'], [['x']]).charCodeAt(0)).not.toBe(0xfeff);
  });

  it('generator streaming menghasilkan output yang sama', () => {
    const rows = [
      ['Budi', 'halo, apa kabar'],
      ['Sari', 'test'],
    ];
    expect(csvFromGenerator(['nama', 'catatan'], rows)).toBe(
      toCSV(['nama', 'catatan'], rows),
    );
    const gen = csvRowGenerator(['a'], [['1'], ['2']]);
    expect(Array.from(gen).join('\r\n')).toBe('a\r\n1\r\n2');
  });
});
