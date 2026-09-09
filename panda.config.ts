import { defineConfig, defineRecipe } from '@pandacss/dev';

// Registered as a config recipe (not an ad-hoc inline recipe) because it's
// shared across two styled() calls (Button, LinkButton) in the same file —
// Panda's static per-JSX-usage extractor was silently dropping the base
// borderRadius and the primary-tone bg for that pattern; a config recipe is
// pre-compiled at config-parse time instead, sidestepping the extractor.
const buttonRecipe = defineRecipe({
  className: 'button',
  base: {
    borderRadius: 'control',
    fontWeight: 'semibold',
    cursor: 'pointer',
    borderWidth: '1px',
    borderColor: 'transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5',
    textDecoration: 'none',
    textAlign: 'center',
    transition:
      'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
    _disabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
      _hover: { transform: 'none', boxShadow: 'none' },
    },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent.default',
      outlineOffset: '2px',
    },
  },
  variants: {
    tone: {
      primary: {
        bg: 'text.primary',
        color: 'bg.surface',
        boxShadow: 'raised',
        _hover: { bg: 'ink.800', boxShadow: 'lifted', transform: 'translateY(-1px)' },
        _active: { transform: 'translateY(0)' },
        _motionReduce: { _hover: { transform: 'none' } },
      },
      // The brand blue fill, for the one action that moves an event forward on
      // a screen (open the live console, reveal, advance) — it picks up the
      // landing page's accent rather than competing with `primary`'s ink.
      accent: {
        bg: 'accent.solid',
        color: 'accent.onSolid',
        boxShadow: 'raised',
        _hover: { bg: 'accent.hover', boxShadow: 'lifted', transform: 'translateY(-1px)' },
        _active: { transform: 'translateY(0)' },
        _motionReduce: { _hover: { transform: 'none' } },
      },
      secondary: {
        bg: 'bg.surface',
        color: 'text.primary',
        borderColor: 'border.default',
        _hover: { bg: 'bg.sunken', borderColor: 'border.strong' },
      },
      // Chromeless until hovered — for icon buttons and low-stakes inline
      // actions that would otherwise crowd a row with borders.
      ghost: {
        bg: 'transparent',
        color: 'text.muted',
        _hover: { bg: 'bg.sunken', color: 'text.primary' },
      },
      danger: {
        bg: 'salmon.600',
        color: 'white',
        boxShadow: 'raised',
        _hover: { bg: 'salmon.700', boxShadow: 'lifted', transform: 'translateY(-1px)' },
        _active: { transform: 'translateY(0)' },
        _motionReduce: { _hover: { transform: 'none' } },
      },
      success: {
        bg: 'green.600',
        color: 'white',
        boxShadow: 'raised',
        _hover: { bg: 'green.700', boxShadow: 'lifted', transform: 'translateY(-1px)' },
        _active: { transform: 'translateY(0)' },
        _motionReduce: { _hover: { transform: 'none' } },
      },
    },
    // 'sm' is for a button sitting inline with small badges/pills (e.g. the
    // participant admission-status row) where the default size reads as
    // oversized next to them.
    size: {
      md: { px: '4', py: '2', minHeight: '11', fontSize: 'sm' },
      sm: { px: '2.5', py: '1', minHeight: '7', fontSize: 'xs' },
      // 'lg' is a page's focal call-to-action: the landing hand-off, and the
      // primary submit on the auth cards.
      lg: { px: '6', py: '3', minHeight: '13', fontSize: 'md' },
      // Square, label-less — a toggle or icon action sized for touch.
      icon: { px: '0', py: '0', width: '11', height: '11', minHeight: '11' },
    },
  },
  defaultVariants: { tone: 'primary', size: 'md' },
})

// Every status pill in the app — event lifecycle, admission, eligibility,
// round/question state — comes from here. They were previously three
// near-identical local recipes with saturated fills that fought the calm
// surface palette; these are soft tints carrying a readable foreground.
const badgeRecipe = defineRecipe({
  className: 'badge',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    flexShrink: '0',
    borderRadius: 'pill',
    borderWidth: '1px',
    borderColor: 'transparent',
    px: '2.5',
    py: '1',
    fontSize: 'xs',
    fontWeight: 'semibold',
    lineHeight: 'tight',
    whiteSpace: 'nowrap',
    textTransform: 'capitalize',
  },
  variants: {
    tone: {
      neutral: { bg: 'bg.sunken', color: 'text.muted', borderColor: 'border.default' },
      accent: { bg: 'accent.subtle', color: 'accent.fg', borderColor: 'accent.border' },
      success: { bg: 'success.subtle', color: 'success.fg', borderColor: 'success.border' },
      danger: { bg: 'danger.subtle', color: 'danger.fg', borderColor: 'danger.border' },
      warning: { bg: 'warning.subtle', color: 'warning.fg', borderColor: 'warning.border' },
    },
    // Micro-labels above a value or section ("JOIN CODE", "STATUS"): the same
    // uppercase, letterspaced treatment the landing page uses for its eyebrow.
    eyebrow: {
      true: {
        bg: 'transparent',
        borderColor: 'transparent',
        px: '0',
        py: '0',
        color: 'text.placeholder',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      },
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Enables the styled-system/jsx `styled` factory (styled-component style)
  jsxFramework: 'react',

  // Where to look for your css declarations
  include: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Files to exclude
  exclude: [],

  // These recipes are shared across many files via styled() indirection
  // (components/ui/Button.tsx exports two, components/ui/Badge.tsx one) —
  // Panda's per-usage JSX extractor was unreliable at generating CSS for
  // every variant through that indirection (notably dropping the button's
  // primary tone, the recipe's own defaultVariants value, even where JSX
  // explicitly passed tone="primary"). Forcing all variants to be
  // pre-generated sidesteps extraction so the CSS is always complete
  // regardless of how or where the recipe is consumed.
  staticCss: {
    recipes: {
      button: ['*'],
      badge: ['*'],
    },
  },

  // Data-attribute selector instead of Panda's default `.dark` class,
  // since theming is driven by our own ThemeProvider (DS2) via [data-theme].
  conditions: {
    dark: '[data-theme="dark"] &',
  },

  // Useful for theme customization
  theme: {
    extend: {
      recipes: {
        button: buttonRecipe,
        badge: badgeRecipe,
      },

      tokens: {
        colors: {
          // Warm-neutral scale — Panda's built-in slate/gray skew cooler
          // than the ~#1f1f1d / ~#f5f5f4 observed in the design reference.
          ink: {
            50: { value: '#fefefe' },
            100: { value: '#f5f5f4' },
            200: { value: '#e5e5e3' },
            300: { value: '#d4d4d1' },
            400: { value: '#a8a8a4' },
            500: { value: '#8a8a86' },
            600: { value: '#6b6b67' },
            700: { value: '#4a4a47' },
            800: { value: '#2e2e2c' },
            900: { value: '#242422' },
            950: { value: '#1f1f1d' },
          },
          // The brand blue, introduced by the landing page and now the app's
          // single accent: active navigation, focus rings, links, icon tiles,
          // live indicators. 300/400 are the desaturated pair the landing
          // gradient is built from; 500 is the brand hex.
          brand: {
            50: { value: '#eff5fd' },
            100: { value: '#dce9fa' },
            200: { value: '#bcd4f4' },
            300: { value: '#b9cbe6' },
            400: { value: '#90a9d1' },
            500: { value: '#5c91e6' },
            600: { value: '#3f6fbd' },
            700: { value: '#2d5490' },
          },
          // Red used for destructive/danger buttons in place of a stock red.
          // 600 is the brand danger hex (#d97a7a); 700 is a matching darker
          // shade for the hover state.
          salmon: {
            50: { value: '#fbeaea' },
            400: { value: '#e8a5a5' },
            500: { value: '#e08f8f' },
            600: { value: '#d97a7a' },
            700: { value: '#c66a6a' },
          },
        },
        radii: {
          control: { value: '10px' }, // inputs, dropdowns, sidebar active-item, skeletons
          card: { value: '12px' }, // empty-state / onboarding cards
          pill: { value: '9999px' }, // tab tracks, switcher badge
        },
        shadows: {
          // Three steps only: a resting card, a filled control, and the
          // hover state either of them lifts into.
          card: { value: '0 1px 2px rgba(31, 31, 29, 0.05)' },
          raised: { value: '0 1px 2px rgba(31, 31, 29, 0.08)' },
          lifted: { value: '0 6px 16px -6px rgba(31, 31, 29, 0.24)' },
        },
        fonts: {
          heading: { value: 'Geist, ui-sans-serif, system-ui, sans-serif' },
          body: { value: 'Geist, ui-sans-serif, system-ui, sans-serif' },
        },
      },

      semanticTokens: {
        colors: {
          'bg.canvas': {
            value: { base: '{colors.ink.200}', _dark: '{colors.ink.950}' },
          },
          'bg.canvas.100': {
            value: { base: '{colors.ink.100}', _dark: '{colors.ink.950}' },
          },
          'bg.surface': { value: { base: 'white', _dark: '{colors.ink.900}' } },
          'bg.sidebar': {
            value: { base: '{colors.ink.100}', _dark: '{colors.ink.900}' },
          },
          'bg.sunken': {
            value: { base: '{colors.ink.100}', _dark: '{colors.ink.800}' },
          },
          'text.primary': {
            value: { base: '{colors.ink.950}', _dark: 'white' },
          },
          'text.muted': {
            value: { base: '{colors.ink.500}', _dark: '{colors.slate.300}' },
          },
          'text.placeholder': {
            value: { base: '{colors.ink.400}', _dark: '{colors.slate.400}' },
          },
          'border.default': {
            value: { base: '{colors.ink.200}', _dark: '{colors.ink.800}' },
          },
          // A step up from border.default, for the hovered/focused edge of a
          // control that should read as interactive without going full accent.
          'border.strong': {
            value: { base: '{colors.ink.300}', _dark: '{colors.ink.700}' },
          },
          // Accent = the landing page's brand blue. `default` is the ink-level
          // value (links, focus rings, active labels); `solid` is a fill with
          // `onSolid` on top; `subtle`/`fg`/`border` make a tinted chip.
          'accent.default': {
            value: { base: '{colors.brand.600}', _dark: '{colors.brand.400}' },
          },
          'accent.solid': {
            value: { base: '{colors.brand.500}', _dark: '{colors.brand.500}' },
          },
          'accent.onSolid': { value: { base: 'white', _dark: 'white' } },
          'accent.hover': {
            value: { base: '{colors.brand.600}', _dark: '{colors.brand.600}' },
          },
          'accent.subtle': {
            value: {
              base: '{colors.brand.50}',
              _dark: 'rgba(92, 145, 230, 0.16)',
            },
          },
          'accent.fg': {
            value: { base: '{colors.brand.700}', _dark: '{colors.brand.300}' },
          },
          'accent.border': {
            value: {
              base: '{colors.brand.200}',
              _dark: 'rgba(92, 145, 230, 0.32)',
            },
          },
          // Status tints, shared by every badge and inline status message.
          'success.subtle': {
            value: { base: '{colors.green.100}', _dark: 'rgba(34, 197, 94, 0.16)' },
          },
          'success.fg': {
            value: { base: '{colors.green.800}', _dark: '{colors.green.300}' },
          },
          'success.border': {
            value: { base: '{colors.green.200}', _dark: 'rgba(34, 197, 94, 0.32)' },
          },
          'danger.subtle': {
            value: { base: '{colors.salmon.50}', _dark: 'rgba(217, 122, 122, 0.18)' },
          },
          'danger.fg': {
            value: { base: '{colors.salmon.700}', _dark: '{colors.salmon.400}' },
          },
          'danger.border': {
            value: { base: '{colors.salmon.400}', _dark: 'rgba(217, 122, 122, 0.34)' },
          },
          'warning.subtle': {
            value: { base: '{colors.amber.100}', _dark: 'rgba(245, 158, 11, 0.16)' },
          },
          'warning.fg': {
            value: { base: '{colors.amber.800}', _dark: '{colors.amber.300}' },
          },
          'warning.border': {
            value: { base: '{colors.amber.200}', _dark: 'rgba(245, 158, 11, 0.32)' },
          },
        },
      },
    },
  },

  // Self-hosted Geist (DS3): the variable font file is sourced from the
  // `geist` package's static assets (dist/fonts/geist-sans/Geist-Variable.woff2,
  // copied into public/fonts/) rather than imported at runtime — the package
  // ships its font loader for next/font, which isn't usable outside Next.js.
  globalCss: {
    '@font-face': {
      fontFamily: 'Geist',
      src: 'url(/fonts/Geist-Variable.woff2) format("woff2")',
      fontWeight: '100 900',
      fontStyle: 'normal',
      fontDisplay: 'swap',
    },
    '@keyframes spin': {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
    // Shared motion. Every consumer pairs these with `_motionReduce` so the
    // interface is fully static for anyone who asks for reduced motion.
    '@keyframes drift': {
      '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
      '50%': { transform: 'translate3d(4%, -6%, 0) scale(1.12)' },
    },
    '@keyframes riseIn': {
      from: { opacity: '0', transform: 'translate3d(0, 14px, 0)' },
      to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
    },
    '@keyframes pulseDot': {
      '0%, 100%': { opacity: '1', transform: 'scale(1)' },
      '50%': { opacity: '0.35', transform: 'scale(0.75)' },
    },
    'html, body': {
      fontFamily: 'body',
    },
    'h1, h2, h3, h4, h5, h6': {
      fontFamily: 'heading',
      letterSpacing: '-0.02em',
    },
  },

  // The output directory for your css system
  outdir: 'styled-system',
});
