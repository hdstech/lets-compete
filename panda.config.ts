import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Enables the styled-system/jsx `styled` factory (styled-component style)
  jsxFramework: "react",

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Data-attribute selector instead of Panda's default `.dark` class,
  // since theming is driven by our own ThemeProvider (DS2) via [data-theme].
  conditions: {
    dark: '[data-theme="dark"] &',
  },

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        colors: {
          // Warm-neutral scale — Panda's built-in slate/gray skew cooler
          // than the ~#1f1f1d / ~#f5f5f4 observed in the design reference.
          ink: {
            50: { value: "#fefefe" },
            100: { value: "#f5f5f4" },
            200: { value: "#e5e5e3" },
            300: { value: "#d4d4d1" },
            400: { value: "#a8a8a4" },
            500: { value: "#8a8a86" },
            600: { value: "#6b6b67" },
            700: { value: "#4a4a47" },
            800: { value: "#2e2e2c" },
            900: { value: "#242422" },
            950: { value: "#1f1f1d" },
          },
        },
        radii: {
          control: { value: "10px" }, // inputs, dropdowns, sidebar active-item, skeletons
          card: { value: "12px" }, // empty-state / onboarding cards
          pill: { value: "9999px" }, // buttons, tab tracks, switcher badge
        },
        fonts: {
          heading: { value: "Geist, ui-sans-serif, system-ui, sans-serif" },
          body: { value: "Geist, ui-sans-serif, system-ui, sans-serif" },
        },
      },

      semanticTokens: {
        colors: {
          "bg.canvas": { value: { base: "{colors.ink.50}", _dark: "{colors.ink.950}" } },
          "bg.surface": { value: { base: "white", _dark: "{colors.ink.900}" } },
          "bg.sidebar": { value: { base: "{colors.ink.100}", _dark: "{colors.ink.900}" } },
          "bg.sunken": { value: { base: "{colors.ink.100}", _dark: "{colors.ink.800}" } },
          "text.primary": { value: { base: "{colors.ink.950}", _dark: "white" } },
          "text.muted": { value: { base: "{colors.ink.500}", _dark: "{colors.slate.400}" } },
          "text.placeholder": { value: { base: "{colors.ink.400}", _dark: "{colors.slate.500}" } },
          "border.default": { value: { base: "{colors.ink.200}", _dark: "{colors.ink.800}" } },
          // Reserved for focus rings / links / active indicators — not button fills.
          "accent.default": { value: { base: "{colors.indigo.500}", _dark: "{colors.indigo.400}" } },
        },
      },
    },
  },

  // Self-hosted Geist (DS3): the variable font file is sourced from the
  // `geist` package's static assets (dist/fonts/geist-sans/Geist-Variable.woff2,
  // copied into public/fonts/) rather than imported at runtime — the package
  // ships its font loader for next/font, which isn't usable outside Next.js.
  globalCss: {
    "@font-face": {
      fontFamily: "Geist",
      src: 'url(/fonts/Geist-Variable.woff2) format("woff2")',
      fontWeight: "100 900",
      fontStyle: "normal",
      fontDisplay: "swap",
    },
    "html, body": {
      fontFamily: "body",
    },
    "h1, h2, h3, h4, h5, h6": {
      fontFamily: "heading",
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
