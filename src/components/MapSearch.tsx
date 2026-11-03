import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import Icon from './Icon'
import { parsePhoton, type PlaceHit } from '../lib/geo'

/**
 * Place search, like the box on Google Maps. Uses Photon by Komoot (OpenStreetMap data):
 * free, no key, made for search-as-you-type. Requests wait for a pause in typing.
 */
export default function MapSearch({ onPick }: { onPick: (h: PlaceHit) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 3) { setHits([]); setStatus('idle'); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setStatus('loading')
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=6&lang=en`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const list = parsePhoton(await res.json())
        setHits(list)
        setActive(0)
        setStatus(list.length ? 'idle' : 'empty')
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setStatus('error')
      }
    }, 350)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  useEffect(() => {
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [])

  const choose = (h: PlaceHit) => { onPick(h); setQ(h.name); setOpen(false) }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(hits.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && hits[active]) { e.preventDefault(); choose(hits[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }
  const showList = open && hits.length > 0

  return (
    <div className="map-search" ref={box}>
      <div className="ms-box">
        <Icon name="search" size={18} />
        <input
          type="search" role="combobox" aria-label="Search for a place" placeholder="Search a place on Earth"
          aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          value={q} autoComplete="off" spellCheck={false}
          onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
        />
        {q && <button className="ms-clear" aria-label="Clear search" data-sfx="back" onClick={() => { setQ(''); setHits([]) }}><Icon name="cross" size={16} /></button>}
      </div>
      {showList && (
        <ul className="ms-list" role="listbox" id={listId}>
          {hits.map((h, i) => (
            <li key={h.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(h)}>
              <strong>{h.name}</strong>
              {h.detail && <small>{h.detail}</small>}
            </li>
          ))}
        </ul>
      )}
      {open && status === 'loading' && !showList && <p className="ms-note">Searching…</p>}
      {open && status === 'empty' && <p className="ms-note">No places found. Try a city, landmark or address.</p>}
      {status === 'error' && <p className="ms-note">Search can't be reached right now. Check your connection and try again.</p>}
    </div>
  )
}
