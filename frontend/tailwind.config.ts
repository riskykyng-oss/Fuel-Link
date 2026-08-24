import type { Config } from "tailwindcss";

/**
 * FuelLink design tokens. One source of truth — the CSS custom properties in
 * src/styles.css — so Tailwind utilities follow the theme (dark/light) and no
 * component references a hex. Class names:
 *
 * bg-base/bg-surface/border-border  → surfaces & hairlines
 * text-text/text-muted              → ink
 * bg-lime text-lime-ink             → accent FILL + its ink (unchanged both themes)
 * text-lime-text border-lime-text   → accent used as INK (darkens in light mode)
 * text-danger/success/warn/blue     → status ink
 */
export default {
  content: ["./src/ui/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        base: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        lime: "var(--accent-fill)",
        "lime-ink": "var(--accent-ink)",
        "lime-text": "var(--accent-text)",
        text: "var(--text)",
        muted: "var(--muted)",
        danger: "var(--danger)",
        success: "var(--success)",
        warn: "var(--warn)",
        blue: "var(--info)",
      },
      borderRadius: {
        card: "12px",
        tile: "10px",
        control: "8px",
      },
    },
  },
  plugins: [],
} satisfies Config;
