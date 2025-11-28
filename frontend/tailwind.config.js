/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        alza: {
          orange: '#ff6b00',
          'orange-light': '#ff9500',
          dark: '#121212',
          'dark-light': '#1a1a1a',
          'dark-lighter': '#2a2a2a'
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
