/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFFDE7',
          100: '#FFF9C4',
          200: '#FFF59D',
          300: '#FFF176',
          400: '#FFEE58',
          500: '#FFEB3B',
          600: '#FDD835',
          700: '#FBC02D',
          800: '#F9A825',
          900: '#F57F17',
        },
        yellowToBlack: {
          50: '#FFFBDE',
          100: '#F5E7C1',
          200: '#EBD4A5',
          300: '#E0C089',
          400: '#D6AD6D',
          500: '#CC9950',
          600: '#A37D40',
          700: '#7A6030',
          800: '#524220',
          900: '#292310',
          950: '#000000',
        },
        background: {
          light: '#FFFBDE',
          dark: '#1a1a1a',
        },
        text: {
          light: '#096B68',
          dark: '#FFFBDE',
        }
      },
    },
  },
  plugins: [],
};