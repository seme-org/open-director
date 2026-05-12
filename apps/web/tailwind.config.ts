import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101012",
        paper: "#f5f1e8",
        ember: "#f16f3a",
        moss: "#6d7f52",
        cyanite: "#315a68",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        brutal: "8px 8px 0 #101012",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
