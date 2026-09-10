import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfigErrorScreen } from './components/ui/ConfigErrorScreen'
import { RootErrorBoundary } from './components/ui/RootErrorBoundary'
import { ToastProvider } from './components/ui/ToastProvider'
import { ThemeProvider } from './features/theme/ThemeProvider'
import { supabaseConfigError } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {supabaseConfigError ? (
        <ConfigErrorScreen message={supabaseConfigError} />
      ) : (
        // The boundary sits outside ToastProvider: a toast is no use once the
        // tree that would have shown it has already unmounted.
        <RootErrorBoundary>
          <ToastProvider>
            <App />
          </ToastProvider>
        </RootErrorBoundary>
      )}
    </ThemeProvider>
  </StrictMode>,
)
