import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  // Wajib ignore direktori tool pihak ketiga yang bukan bagian proyek
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "ponytail/**",
      "hallmark/**",
      "ui-ux-pro-max-skill/**",
      ".agents/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
