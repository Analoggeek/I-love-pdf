import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Header, Footer, ConsentBanner, PageLoader } from './components'
import { apiRequest } from './lib/api'

const Home = lazy(() => import('./pages/Home'))
const ToolPage = lazy(() => import('./pages/ToolPage'))
const AccountPages = lazy(() => import('./pages/AccountPages'))
const InfoPage = lazy(() => import('./pages/InfoPage'))

function RouteAnalytics() {
  const location = useLocation()
  useEffect(() => {
    if (localStorage.getItem('a1pt-consent') !== 'analytics') return
    const path = `${location.pathname}${location.search}`.slice(0, 300)
    void apiRequest('/api/analytics', { method: 'POST', body: JSON.stringify({ event: 'page_view', consent: 'analytics', path }) }).catch(() => undefined)
  }, [location.pathname, location.search])
  useEffect(() => {
    const update = () => {
      if (localStorage.getItem('a1pt-theme') === 'system') document.documentElement.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return null
}

function Shell() {
  return (
    <>
      <RouteAnalytics />
      <Header />
      <main id="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:toolId" element={<ToolPage />} />
            <Route path="/login" element={<AccountPages mode="login" />} />
            <Route path="/dashboard" element={<AccountPages mode="dashboard" />} />
            <Route path="/admin" element={<AccountPages mode="admin" />} />
            <Route path="/privacy" element={<InfoPage page="privacy" />} />
            <Route path="/terms" element={<InfoPage page="terms" />} />
            <Route path="/cookies" element={<InfoPage page="cookies" />} />
            <Route path="/disclaimer" element={<InfoPage page="disclaimer" />} />
            <Route path="/about" element={<InfoPage page="about" />} />
            <Route path="/contact" element={<InfoPage page="contact" />} />
            <Route path="*" element={<InfoPage page="not-found" />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <ConsentBanner />
    </>
  )
}

export default function App() { return <Shell /> }
