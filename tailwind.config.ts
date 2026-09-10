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
        golf: {
          50: "#f3faf4",
          100: "#e3f5e6",
          200: "#c8eacc",
          300: "#9dd8a6",
          400: "#6bbe78",
          500: "#45a154",
          600: "#348442",
          700: "#2c6937",
          800: "#26542f",
          900: "#214528",
          950: "#0e2514",
        },
        fairway: "#7cb87a",
        sand: "#f5e6c8",
        tee: "#2d6a4f",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(45, 106, 79, 0.12)",
        card: "0 2px 12px rgba(14, 37, 20, 0.08)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
