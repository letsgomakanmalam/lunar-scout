import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useGame } from './store'
import App from './App'
describe('smoke', () => {
  for (const s of ['title','missions','explore','land','build','journal','dashboard','about'] as const) {
    it(s, () => {
      useGame.setState({ screen: s, landingId: s === 'build' ? 'shackleton' : null, researchPoints: 500, selectedSiteId: s==='explore' ? 'lonar' : null, scanned: { tutorial: ['lonar'] } })
      const html = renderToString(<App />)
      expect(html.length).toBeGreaterThan(200)
    })
  }
})
