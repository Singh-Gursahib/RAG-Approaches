import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#fbfbfd",
        surface: "#ffffff",
        border: "#e5e5e7",
        ink: {
          DEFAULT: "#1d1d1f",
          muted: "#86868b",
          faint: "#a1a1a6",
          subtle: "#d2d2d7",
        },
        accent: {
          DEFAULT: "#cf4520",
          hover: "#b03c1c",
          subtle: "#fbece6",
        },
        approach: {
          sliding: "#1d1d1f",
          full: "#cf4520",
          rerank: "#2d6a4f",
          naive: "#6b7280",
          hyde: "#b8761a",
          hybrid: "#8b6f5e",
          recursive: "#9b1d20",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
