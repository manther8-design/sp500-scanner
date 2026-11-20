import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b1220",
          900: "#111827",
          800: "#1a2438",
          700: "#243049",
        },
        mist: {
          50: "#f4f7fb",
          100: "#e8eef7",
          200: "#d5e0ef",
        },
        signal: {
          up: "#0f7a4f",
          down: "#b42318",
          wait: "#9a6b00",
        },
        accent: {
          DEFAULT: "#1f6feb",
          soft: "#dbe8ff",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Segoe UI", "Tahoma", "sans-serif"],
      },
      backgroundImage: {
        mesh: "radial-gradient(1200px 600px at 10% -10%, rgba(31,111,235,0.18), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(15,122,79,0.12), transparent 50%), linear-gradient(180deg, #0b1220 0%, #111827 45%, #0f172a 100%)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        rise: "rise 0.55s ease-out both",
        pulseSoft: "pulseSoft 2.4s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
