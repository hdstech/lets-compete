import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { css } from '../styled-system/css'

function Home() {
  return (
    <main
      className={css({
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        bg: 'slate.950',
        color: 'slate.100',
      })}
    >
      <h1 className={css({ fontSize: '2xl', fontWeight: 'semibold' })}>Event Scoring App</h1>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
