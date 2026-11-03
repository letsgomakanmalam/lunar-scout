import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker } from 'maplibre-gl'
import { EARTH_SITES } from '../data/earthSites'
import { fmtLat, fmtLon } from '../lib/format'

interface Props {
  selectedId: string | null
  scannedIds: string[]
  onSelect: (id: string | null) => void
}

// NASA GIBS Blue Marble tiles: free, no API key, and NASA data.
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'
const STATUS_COLOR = ['match', ['get', 'status'], 'candidate', '#e9b24c', 'local', '#ff7ab8', '#ebe6da'] as unknown as string

function featureCollection(selectedId: string | null, scannedIds: string[]) {
  return {
    type: 'FeatureCollection' as const,
    features: EARTH_SITES.map(s => ({
      type: 'Feature' as const,
      properties: { id: s.id, name: s.name, status: s.status, selected: s.id === selectedId ? 1 : 0, scanned: scannedIds.includes(s.id) ? 1 : 0 },
      geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
    })),
  }
}

export default function EarthMap({ selectedId, scannedIds, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const lockMarker = useRef<Marker | null>(null)
  const readout = useRef<HTMLSpanElement>(null)
  const [failed, setFailed] = useState(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const latest = useRef({ selectedId, scannedIds })
  latest.current = { selectedId, scannedIds }

  useEffect(() => {
    if (!box.current) return
    let m: MLMap
    try {
      m = new maplibregl.Map({
        container: box.current,
        style: {
          version: 8,
          sources: { gibs: { type: 'raster', tiles: [GIBS], tileSize: 256, maxzoom: 8, attribution: 'Imagery: NASA GIBS Blue Marble' } },
          // Slightly darker, cooler imagery so the site markers carry the colour.
          layers: [{ id: 'gibs', type: 'raster', source: 'gibs', paint: { 'raster-saturation': -0.2, 'raster-contrast': 0.1, 'raster-brightness-max': 0.84 } }],
        },
        center: [20, 20],
        zoom: 1.2,
        maxZoom: 8,
        attributionControl: { compact: true },
      })
    } catch {
      setFailed(true) // usually no WebGL on this device; the site list still works
      return
    }
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const showCenter = () => {
      const c = m.getCenter()
      if (readout.current) readout.current.textContent = `${fmtLat(c.lat)}   ${fmtLon(c.lng)}   zoom ${m.getZoom().toFixed(1)}`
    }
    m.on('move', showCenter)
    m.on('load', () => {
      showCenter()
      m.addSource('sites', { type: 'geojson', data: featureCollection(latest.current.selectedId, latest.current.scannedIds) })
      m.addLayer({ id: 'sites-glow', type: 'circle', source: 'sites', paint: { 'circle-radius': 15, 'circle-blur': 1, 'circle-opacity': 0.45, 'circle-color': STATUS_COLOR } })
      m.addLayer({
        id: 'sites', type: 'circle', source: 'sites',
        paint: {
          'circle-radius': 6,
          'circle-color': STATUS_COLOR,
          'circle-stroke-width': ['case', ['==', ['get', 'scanned'], 1], 2.5, 1.5],
          'circle-stroke-color': ['case', ['==', ['get', 'scanned'], 1], '#5fe0a2', '#05070d'],
        },
      })
      m.on('click', 'sites', e => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (id) onSelectRef.current(id)
      })
      m.on('mouseenter', 'sites', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'sites', () => (m.getCanvas().style.cursor = ''))
    })
    map.current = m
    return () => { lockMarker.current?.remove(); lockMarker.current = null; m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    ;(m.getSource('sites') as GeoJSONSource | undefined)?.setData(featureCollection(selectedId, scannedIds))
    const site = EARTH_SITES.find(s => s.id === selectedId)
    if (!site) { lockMarker.current?.remove(); lockMarker.current = null; return }
    if (!lockMarker.current) {
      const el = document.createElement('div')
      el.className = 'site-lock'
      el.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="17"/><path d="M32 3v11M32 50v11M3 32h11M50 32h11"/></svg>'
      lockMarker.current = new maplibregl.Marker({ element: el }).setLngLat([site.lon, site.lat]).addTo(m)
    } else {
      lockMarker.current.setLngLat([site.lon, site.lat])
    }
    m.easeTo({ center: [site.lon, site.lat], zoom: Math.max(m.getZoom(), 3), duration: 900 })
  }, [selectedId, scannedIds])

  return (
    <div className="map-wrap">
      <div ref={box} className="map" role="application" aria-label="Map of Earth analog sites" />
      <div className="map-hud" aria-hidden="true"><span className="mh-cross" /><span className="mh-scan" /></div>
      <div className="map-readout" aria-hidden="true"><span ref={readout}>20.00° N   20.00° E   zoom 1.2</span></div>
      {failed && <div className="map-fallback">This device can't draw the map. Choose a site from the list instead.</div>}
      <div className="legend">
        <span><i className="dot known" />Known analog</span>
        <span><i className="dot candidate" />New candidate</span>
        <span><i className="dot local" />Malaysia</span>
        <span><i className="dot scanned" />Scanned</span>
      </div>
    </div>
  )
}
