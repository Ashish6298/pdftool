/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bbdffd',
          300: '#7cc2fc',
          400: '#36a2fa',
          500: '#0c86eb',
          600: '#026bc7',
          700: '#0355a1',
          800: '#074885',
          900: '#0c3e6e',
          950: '#082749',
        }
      }
    },
  },
  plugins: [],
}
