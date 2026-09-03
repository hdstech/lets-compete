const fs = require('fs')
const path = require('path')

// Panda 1.12's config loader compares the resolved config path to
// fs.realpathSync.native(), which on Windows returns a capital drive letter.
// Git Bash (and some other shells) start Node with cwd `c:\...`, so the
// comparison fails, the bundled config is discarded, and `include` is missing
// — which crashes PostCSS with `ctx.config.include is not iterable`.
const cwd = fs.realpathSync.native(__dirname)

module.exports = {
  plugins: {
    '@pandacss/dev/postcss': {
      cwd,
      configPath: path.join(cwd, 'panda.config.ts'),
    },
  },
}
