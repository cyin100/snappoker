
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: { burst: { '0%':{transform:'scale(0.95)'}, '50%':{transform:'scale(1.05)'}, '100%':{transform:'scale(1)'} } },
      animation: { burst: 'burst .35s ease-out 1' },
      boxShadow: { 'turn': '0 0 0 2px rgba(129,140,248,.9), 0 0 24px rgba(129,140,248,.35)' }
    }
  },
  plugins: []
}
