/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        strans: {
          blue: '#0056b3',
          orange: '#ff6600',
          light: '#f4f6f8'
        }
      }
    },
  },
  plugins: [],
}