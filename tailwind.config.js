/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Organic / earthy palette: warm brown chrome (headers/tabs, inline hex
      // in nav configs) + a warm amber accent. Semantic roles keep their
      // Tailwind family name so utility classes stay readable:
      //   amber  -> primary / interactive (default Tailwind amber, warm gold)
      //   green  -> success               (earthy leaf / moss green)
      //   orange -> warning               (ochre / clay)
      //   red    -> error / danger        (Tailwind default vivid red)
      //   stone  -> neutrals              (unchanged Tailwind default)
      colors: {
        green: {
          50: "#f1f5e8",
          100: "#dee9c7",
          200: "#c3d69f",
          300: "#a4c176",
          400: "#88ab54",
          500: "#6f9440",
          600: "#5b7d34",
          700: "#48632a",
          800: "#3a4f24",
          900: "#31411f",
        },
        orange: {
          50: "#f7efe0",
          100: "#f0e3c8",
          200: "#e4cd9d",
          300: "#d5b46f",
          400: "#c79a4a",
          500: "#b5843a",
          600: "#9c6b2e",
          700: "#7f5527",
          800: "#684522",
          900: "#573a20",
        },
      },
    },
  },
  plugins: [],
};
