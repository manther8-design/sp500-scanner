import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1E293B",
        brand: {
          blue: "#0284C7",
          green: "#10B981",
          orange: "#F59E0B",
          red: "#EF4444",
        },
      },
      fontFamily: {
        arabic: ['"IBM Plex Sans Arabic"', "sans-serif"],
        display: ['"Space Grotesk"', '"IBM Plex Sans Arabic"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
