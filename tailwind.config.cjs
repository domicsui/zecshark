/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shark: {
          orange: '#FF8800',
          'orange-light': '#FFA726',
          'orange-dark': '#E65100',
          yellow: '#FFC107',
          'yellow-light': '#FFE082',
          'yellow-bright': '#FFEB3B',
          arcade: '#0B0C10',
          panel: '#15161E',
          'panel-light': '#1F212D',
          border: '#000000',
          accent: '#FFB300'
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        'pixel-sm': '2px 2px 0px #000000',
        'pixel': '4px 4px 0px #000000',
        'pixel-lg': '6px 6px 0px #000000',
        'pixel-xl': '8px 8px 0px #000000',
        'pixel-glow': '0 0 16px rgba(255, 153, 0, 0.45)',
        'pixel-yellow': '4px 4px 0px #FFC107'
      }
    },
  },
  plugins: [],
};
