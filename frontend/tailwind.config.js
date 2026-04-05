/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#2E6DA4",  // Accent-Blau als primary-500
          600: "#1E3A5F",  // Dunkelblau als primary-600
          700: "#1a3354",
          800: "#122540",  // Tiefblau
          900: "#0d1b30",
          950: "#091220",
        },
      },
      fontFamily: {
        sans: ["Calibri", "'Segoe UI'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
