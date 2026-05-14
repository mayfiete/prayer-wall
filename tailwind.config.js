/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: ['tile-stone', 'tile-brick', 'tile-name', 'tile-cta', 'tile-empty', 'stone-wall', 'stone-row', 'stone-row--offset'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        parchment: {
          50:  '#fdfaf7',
          100: '#f8f4f0',
          200: '#ede3d8',
          300: '#e0d8cf',
          400: '#c8bdb0',
        },
        stone: {
          warm: '#7c7872',
        },
      },
      animation: {
        'brick-in': 'brickIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        brickIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(251, 191, 36, 0.3)' },
        },
      },
    },
  },
  plugins: [],
}
