import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0a0a0f",
          secondary: "#111118",
          card: "#16161f",
          elevated: "#1c1c28",
          border: "#2a2a3a",
        },
        gold: {
          DEFAULT: "#d4a843",
          light: "#e8c062",
          dim: "#9a7a2e",
        },
        bull: "#22c55e",
        bear: "#ef4444",
        neutral: "#94a3b8",
        mana: {
          white: "#f9f0d4",
          blue: "#4a90d9",
          black: "#9b59b6",
          red: "#e74c3c",
          green: "#27ae60",
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["system-ui", "sans-serif"],
      },
      backgroundImage: {
        "radial-dark": "radial-gradient(ellipse at top, #1a1a2e 0%, #0a0a0f 70%)",
        "gold-shimmer": "linear-gradient(135deg, #d4a843 0%, #e8c062 50%, #d4a843 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pulseGold: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.6" } },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
