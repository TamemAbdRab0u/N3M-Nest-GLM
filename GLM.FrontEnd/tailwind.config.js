module.exports = {
  content: ["./**/*.html", "./**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "background-light": "rgb(var(--color-background-light) / <alpha-value>)",
        "background-dark": "rgb(var(--color-background-dark) / <alpha-value>)",
        "surface-dark": "rgb(var(--color-surface-dark) / <alpha-value>)",
        "surface-light": "rgb(var(--color-surface-light) / <alpha-value>)",
        "input-bg": "rgb(var(--color-input-bg) / <alpha-value>)",
        "input-border": "rgb(var(--color-input-border) / <alpha-value>)",
        "kinetic-blue": "rgb(var(--color-kinetic-blue) / <alpha-value>)",
        "neon-green": "rgb(var(--color-neon-green) / <alpha-value>)",
        "accent-glow": "rgb(var(--color-accent-glow) / <alpha-value>)",
        "deep-teal": "rgb(var(--color-deep-teal) / <alpha-value>)",
        "cyber-cyan": "rgb(var(--color-cyber-cyan) / <alpha-value>)",
        "cyber-cyan-muted": "rgb(var(--color-cyber-cyan-muted) / <alpha-value>)",
        "glass-bg": "rgb(var(--color-glass-bg) / <alpha-value>)",
        "status-online": "rgb(var(--color-status-online) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "card-bg": "rgb(var(--color-card-bg) / <alpha-value>)"
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        heading: ["Space Grotesk", "sans-serif"],
        orbitron: ["Orbitron", "sans-serif"],
        rajdhani: ["Rajdhani", "sans-serif"]
      }
    }
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")]
};
