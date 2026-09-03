// Standalone dependency check, run with `npm run icon:smoke-test`.
// Confirms lucide-react renders a 16px, currentColor-stroke icon before
// anything in the app actually consumes it (DS4).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Search } from 'lucide-react'

const markup = renderToStaticMarkup(createElement(Search, { size: 16 }))

if (!markup.includes('width="16"') || !markup.includes('height="16"')) {
  console.error('Icon did not render at 16px:', markup)
  process.exit(1)
}

if (!markup.includes('stroke="currentColor"')) {
  console.error('Icon did not inherit currentColor stroke:', markup)
  process.exit(1)
}

console.log('lucide-react icon renders at 16px with currentColor stroke.')
