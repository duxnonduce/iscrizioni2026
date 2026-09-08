import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          DEFAULT: "#0B3D91",
          dark: "#062654",
          light: "#3B6FC4",
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
