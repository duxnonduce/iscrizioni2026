import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          DEFAULT: "#13275C",
          dark: "#0A1633",
          light: "#3B5FA4",
        },
        navy: {
          DEFAULT: "#0A0F24",
          deep: "#060A1A",
        },
        ace: "#D6E4FF",
        chalk: "#F7F9FC",
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
