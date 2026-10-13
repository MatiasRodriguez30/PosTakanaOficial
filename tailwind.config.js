/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c7ff',
          400: '#85a3ff',
          500: '#4d75ff', // Vibrant retail blue
          600: '#2e4eff',
          700: '#1a32ff',
          800: '#0014e6',
          950: '#0008b3',
        },
      },
    },
  },
  plugins: [],
}
