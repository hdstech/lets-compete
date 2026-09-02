import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { styled } from '../styled-system/jsx'

const HomeMain = styled('main', {
  base: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    bg: 'slate.950',
    color: 'slate.100',
  },
})

const HomeHeading = styled('h1', {
  base: {
    fontSize: '2xl',
    fontWeight: 'semibold',
  },
})

function Home() {
  return (
    <HomeMain>
      <HomeHeading>Event Scoring App</HomeHeading>
    </HomeMain>
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
