export default {
  plugins: {
    "@tailwindcss/postcss": {
      content: [
        "./src/**/*.{js,ts,jsx,tsx}",
      ],
    },
    ...(process.env.NODE_ENV === 'production' ? { cssnano: {} } : {})
  },
};