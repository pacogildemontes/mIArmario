/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primario: '#1f6feb',
        exito: '#00a676',
        alerta: '#f59e0b',
        peligro: '#dc2626'
      }
    }
  },
  plugins: []
};
