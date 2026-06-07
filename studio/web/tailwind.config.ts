import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core surface tokens (mirrored as CSS vars in globals.css).
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        line: "var(--line)",
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
        },
        // Per-approach palette — kept identical to frontend/web/lib/colors.ts and
        // the paper figures so the whole project is visually coherent.
        approach: {
          sliding: "#1d1d1f",
          full: "#cf4520",
          rerank: "#2d6a4f",
          naive: "#6b7280",
          hyde: "#b8761a",
          hybrid: "#8b6f5e",
          recursive: "#9b1d20",
        },
        probe: {
          sanity: "#7d8597",
          hallucination: "#9b1d20",
          needle: "#cf4520",
          multihop: "#2d6a4f",
          distractor: "#b8761a",
        },
      },
      fontFamily: {
        // Display + body both use Geist; numerals/identifiers use JetBrains Mono.
        display: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      borderRadius: {
        card: "18px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,26,26,0.04), 0 8px 30px rgba(26,26,26,0.05)",
        lift: "0 2px 6px rgba(26,26,26,0.06), 0 18px 50px rgba(26,26,26,0.08)",
      },
      maxWidth: {
        shell: "1120px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulse_soft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.6s ease both",
        "pulse-soft": "pulse_soft 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
