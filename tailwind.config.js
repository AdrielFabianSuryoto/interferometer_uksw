/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#F4FAF2',
        card: '#FFFFFF',
        primary: '#102014',
        secondary: '#647067',
        border: '#DDE8DD',
        'primary-green': '#7BBF22',
        'dark-green': '#2F6B2F',
        'soft-green': '#EEF8E8',
        'scientific-blue': '#2563EB',
        'soft-blue': '#EFF6FF',
        'warning-red': '#D62828',
        'muted-red': '#FFF1F1'
      },
      boxShadow: {
        'neu-raised': '8px 8px 18px rgba(47, 107, 47, 0.12), -8px -8px 18px rgba(255, 255, 255, 0.95)',
        'neu-floating': '14px 14px 32px rgba(47, 107, 47, 0.18), -10px -10px 24px rgba(255, 255, 255, 0.96)',
        'neu-flat': '0 18px 40px rgba(47, 107, 47, 0.14)',
        'neu-inset-soft': 'inset 5px 5px 10px rgba(47, 107, 47, 0.08), inset -5px -5px 10px rgba(255, 255, 255, 0.9)',
        'neu-button': '6px 6px 14px rgba(47, 107, 47, 0.24), -5px -5px 12px rgba(255, 255, 255, 0.88)',
        'green-glow': '0 14px 24px rgba(123, 191, 34, 0.25)'
      }
    }
  },
  plugins: []
};
