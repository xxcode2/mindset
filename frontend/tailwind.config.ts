import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05050f",
        surface: "#0f0f23",
        // Brand
        primary: "#6366f1", // indigo-500
        secondary: "#8b5cf6", // purple-500
        accent: "#818cf8", // indigo-400
        // Outcomes
        yes: "#34d399",
        no: "#f87171",
        // Text
        ink2: "#0a0a1a",
        text1: "#f1f5f9",
        text2: "#e2e8f0",
        text3: "#cbd5e1",
        muted: "#94a3b8",
      },
      fontFamily: {
        outfit: ["var(--font-outfit)", "Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-glow": "pulseGlow 4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        float: {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "33%": { transform: "translateY(-8px) rotate(1deg)" },
          "66%": { transform: "translateY(4px) rotate(-1deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
