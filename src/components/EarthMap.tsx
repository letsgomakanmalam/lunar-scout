import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap, type Marker, type StyleSpecification, type RasterTileSource } from 'maplibre-gl'
import { EARTH_SITES } from '../data/earthSites'
import type { EarthSite } from '../data/types'
import { useGame, type MapBase, type MapPrefs } from '../store'
import { distanceKm, formatDistance, greatCircle, nearest, pathKm, unwrapLon, type LatLon, type PlaceHit } from '../lib/geo'
import { nightBands, skyAt, type SkyNow } from '../lib/sky'
import { installLiveProtocol, liveStamp, liveTileUrl } from '../lib/liveTiles'
import { fmtCoords, fmtLat, fmtLon } from '../lib/format'
import MapSearch from './MapSearch'
import Icon from './Icon'

interface Props {
  selectedId: string | null
  scannedIds: string[]
  onSelect: (id: string | null) => void
  /** Sites to show: the curated list plus live discoveries */
  sites?: EarthSite[]
  /** Called when the player probes a point with live data (probe tool or a search result) */
  onProbe?: (lat: number, lon: number) => void
  /** A probe in progress, shown as a pulsing ring */
  probing?: { lat: number; lon: number } | null
}

// Street map: OpenFreeMap "Liberty" (OpenStreetMap data, free, no key). If it can't load, the
// map falls back to imagery only so the game still works.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const FALLBACK: StyleSpecification = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#02040a' } }] }
const BLUE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'
const VIIRS = (date: string) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
const S2 = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'
const OWN = new Set(['ls-blue', 'ls-s2', 'ls-today', 'ls-night', 'ls-measure-line', 'ls-measure-pts', 'sites-glow', 'sites'])
const STATUS_COLOR = ['match', ['get', 'status'], 'candidate', '#e9b24c', 'local', '#ff7ab8', 'discovery', '#4fe3d0', '#ebe6da'] as unknown as string

export const BASES: { id: MapBase; label: string; note: (date: string) => string }[] = [
  { id: 'live', label: 'Live Earth', note: d => `NASA satellite, ${d}` },
  { id: 'satellite', label: 'Satellite', note: () => 'Sentinel-2, 10 m detail' },
  { id: 'map', label: 'Map', note: () => 'Streets and places' },
  { id: 'blue', label: 'Blue Marble', note: () => 'NASA classic' },
]

const SVG = (body: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

/** Extra buttons that sit in the same column as the zoom and location buttons. */
class ToolControl implements maplibregl.IControl {
  private el: HTMLDivElement | null = null
  constructor(private tools: { id: string; title: string; svg: string; onClick: () => void }[], private refs: Record<string, HTMLButtonElement>) {}
  onAdd() {
    const el = document.createElement('div')
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    for (const t of this.tools) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'ls-tool'
      b.title = t.title
      b.setAttribute('aria-label', t.title)
      b.innerHTML = t.svg
      b.addEventListener('click', t.onClick)
      el.appendChild(b)
      this.refs[t.id] = b
    }
    this.el = el
    return el
  }
  onRemove() { this.el?.remove() }
}

function sitesData(sites: EarthSite[], selectedId: string | null, scannedIds: string[]) {
  return {
    type: 'FeatureCollection' as const,
    features: sites.map(s => ({
      type: 'Feature' as const,
      properties: { id: s.id, name: s.name, status: s.status, selected: s.id === selectedId ? 1 : 0, scanned: scannedIds.includes(s.id) ? 1 : 0 },
      geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
    })),
  }
}

/** Adds our imagery, night, measuring and site layers to whichever style is loaded. */
function install(map: MLMap, date: string, liveUrl: string) {
  if (map.getSource('sites')) return
  const layers = map.getStyle().layers
  const aboveBackground = layers.find(l => l.type !== 'background')?.id
  const belowLabels = layers.find(l => l.type === 'symbol')?.id
  map.addSource('ls-blue', { type: 'raster', tiles: [BLUE], tileSize: 256, maxzoom: 8, attribution: 'Imagery: NASA GIBS Blue Marble' })
  map.addSource('ls-s2', { type: 'raster', tiles: [S2], tileSize: 256, maxzoom: 14, attribution: '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024)' })
  // Composited in the browser: the daily picture over a dimmed Blue Marble wherever it has no data (lib/liveTiles.ts)
  map.addSource('ls-today', { type: 'raster', tiles: [liveUrl], tileSize: 256, maxzoom: 9, attribution: `NASA GIBS, VIIRS NOAA-20 (newest up to ${date}); no-data areas from Blue Marble` })
  const hidden = { visibility: 'none' as const }
  map.addLayer({ id: 'ls-blue', type: 'raster', source: 'ls-blue', layout: hidden }, aboveBackground)
  map.addLayer({ id: 'ls-s2', type: 'raster', source: 'ls-s2', layout: hidden }, aboveBackground)
  // Today's NASA picture covers the globe; it fades into sharper Sentinel-2 detail as you zoom in.
  map.addLayer({ id: 'ls-today', type: 'raster', source: 'ls-today', layout: hidden, paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 5, 1, 8, 0] } }, aboveBackground)
  map.addSource('ls-night', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'ls-night', type: 'fill', source: 'ls-night', paint: { 'fill-color': '#01030a', 'fill-opacity': 0.2 } }, belowLabels)
  map.addSource('ls-measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'ls-measure-line', type: 'line', source: 'ls-measure', filter: ['==', ['geometry-type'], 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffd98c', 'line-width': 3, 'line-dasharray': [2, 1.4] } })
  map.addLayer({ id: 'ls-measure-pts', type: 'circle', source: 'ls-measure', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5.5, 'circle-color': '#ffffff', 'circle-stroke-color': '#e9b24c', 'circle-stroke-width': 2.5 } })
  map.addSource('sites', { type: 'geojson', data: sitesData(EARTH_SITES, null, []) })
  map.addLayer({ id: 'sites-glow', type: 'circle', source: 'sites', paint: { 'circle-radius': 15, 'circle-blur': 1, 'circle-opacity': 0.45, 'circle-color': STATUS_COLOR } })
  map.addLayer({
    id: 'sites', type: 'circle', source: 'sites',
    paint: {
      'circle-radius': 6, 'circle-color': STATUS_COLOR,
      'circle-stroke-width': ['case', ['==', ['get', 'scanned'], 1], 2.5, 1.5],
      'circle-stroke-color': ['case', ['==', ['get', 'scanned'], 1], '#5fe0a2', '#05070d'],
    },
  })
}

/** Shows the chosen map type and details by switching layers on and off (no reload). */
function apply(map: MLMap, p: MapPrefs, streetsOk: boolean) {
  const base = !streetsOk && p.base === 'map' ? 'blue' : p.base
  const imagery = base !== 'map'
  const vis = (id: string, on: boolean) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none') }
  vis('ls-blue', base === 'blue')
  vis('ls-s2', base === 'satellite' || base === 'live')
  vis('ls-today', base === 'live')
  for (const l of map.getStyle().layers) {
    if (OWN.has(l.id)) continue
    if (l.type === 'symbol') vis(l.id, p.labels)
    // The street style's own relief shading would cover the satellite pictures
    else if (l.type === 'raster' || l.type === 'hillshade') vis(l.id, !imagery)
    else if (l.type === 'background' || l.type === 'fill' || l.type === 'fill-extrusion') vis(l.id, !imagery)
  }
  vis('ls-night', p.dayNight)
}

const tile = (t: string, z: number, y: number, x: number) => t.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x))

/** The Sun and Moon share one label when their points are close: at new moon they sit on top of each other. */
function syncSkyLabels(map: MLMap, marks: { sun: Marker; moon: Marker } | null, sky: SkyNow) {
  if (!marks) return
  const a = map.project([sky.sun.lon, sky.sun.lat]), b = map.project([sky.moon.lon, sky.moon.lat])
  const close = (Math.abs(a.x - b.x) < 150 && Math.abs(a.y - b.y) < 40) || distanceKm(sky.sun, sky.moon) < 600
  const label = marks.sun.getElement().querySelector('span')
  if (label) label.textContent = close ? 'Sun and Moon overhead' : 'Sun overhead'
  marks.moon.getElement().classList.toggle('label-off', close)
}

function skyMarker(kind: 'sun' | 'moon') {
  const el = document.createElement('div')
  el.className = `sky-mark sky-${kind}`
  el.innerHTML = `<i></i><span>${kind === 'sun' ? 'Sun overhead' : 'Moon overhead'}</span>`
  return new maplibregl.Marker({ element: el })
}

export default function EarthMap({ selectedId, scannedIds, onSelect, sites = EARTH_SITES, onProbe, probing = null }: Props) {
  const prefs = useGame(s => s.mapPrefs)
  const setPrefs = useGame(s => s.setMapPrefs)
  const me = useGame(s => s.myLocation)
  const setMe = useGame(s => s.setMyLocation)
  const box = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const geoRef = useRef<maplibregl.GeolocateControl | null>(null)
  const scaleRef = useRef<maplibregl.ScaleControl | null>(null)
  const readout = useRef<HTMLSpanElement>(null)
  const lockMarker = useRef<Marker | null>(null)
  const pinMarker = useRef<Marker | null>(null)
  const skyMarks = useRef<{ sun: Marker; moon: Marker } | null>(null)
  const labels = useRef<Marker[]>([])
  const tools = useRef<Record<string, HTMLButtonElement>>({})
  const [ready, setReady] = useState(false)
  const [streetsOk, setStreetsOk] = useState(true)
  const [failed, setFailed] = useState(false)
  const [panel, setPanel] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const [probeMode, setProbeMode] = useState(false)
  const probeMarker = useRef<Marker | null>(null)
  const [points, setPoints] = useState<LatLon[]>([])
  const [place, setPlace] = useState<PlaceHit | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [sky, setSky] = useState<SkyNow>(() => skyAt(new Date()))
  // Yesterday (UTC) is the latest full day of NASA's near-real-time satellite pictures.
  // Follows the computer's clock: its own date, refreshed every hour as NASA adds new orbits
  const [stamp, setStamp] = useState(() => liveStamp())
  const date = stamp.date
  const liveUrl = liveTileUrl(stamp.date, stamp.refresh)
  const appliedLive = useRef(liveUrl)
  const dateLabel = useMemo(() => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), [date])

  const live = useRef({ selectedId, scannedIds, onSelect, measuring, prefs, sky, sites, probeMode, onProbe })
  live.current = { selectedId, scannedIds, onSelect, measuring, prefs, sky, sites, probeMode, onProbe }

  useEffect(() => {
    if (!box.current) return
    let map: MLMap
    installLiveProtocol((d, z, y, x) => tile(VIIRS(d), z, y, x), (z, y, x) => tile(BLUE, z, y, x))
    try {
      map = new maplibregl.Map({
        container: box.current, style: STYLE_URL, center: [20, 20], zoom: 1.2, maxZoom: 18,
        attributionControl: { compact: true },
        cooperativeGestures: window.matchMedia('(pointer: coarse)').matches, // one finger scrolls the page, two move the map
      })
    } catch {
      setFailed(true) // usually no WebGL on this device; the site list still works
      return
    }
    mapRef.current = map
    // Never zoom out so far that several Earths sit side by side: one Earth always fills the width
    const fitWorld = () => map.setMinZoom(Math.max(0, Math.log2((box.current?.clientWidth || 512) / 512)))
    fitWorld()
    map.on('resize', fitWorld)
    let skyRaf = 0
    map.on('move', () => {
      cancelAnimationFrame(skyRaf)
      skyRaf = requestAnimationFrame(() => syncSkyLabels(map, skyMarks.current, live.current.sky))
    })
    let styled = false
    let fellBack = false
    const fallBack = () => {
      if (styled || fellBack) return
      fellBack = true
      setStreetsOk(false)
      map.setStyle(FALLBACK)
    }
    const timer = setTimeout(fallBack, 9000)
    map.on('error', fallBack) // only acts while no style has loaded yet
    map.on('style.load', () => {
      styled = true
      clearTimeout(timer)
      install(map, date, appliedLive.current)
      const L = live.current
      ;(map.getSource('sites') as GeoJSONSource).setData(sitesData(L.sites, L.selectedId, L.scannedIds))
      ;(map.getSource('ls-night') as GeoJSONSource).setData(nightBands(L.sky.sun))
      apply(map, L.prefs, !fellBack)
      // Fold the credits behind the (i) button once the map has settled, so they don't cover the legend
      map.once('idle', () => box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'))
      setReady(r => r || true)
      setPoints(p => [...p]) // redraw any measurement on the new style
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    const geo = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true })
    geo.on('geolocate', (e: unknown) => {
      const c = (e as GeolocationPosition).coords
      setMe({ lat: c.latitude, lon: c.longitude })
      setGeoError(null)
    })
    geo.on('error', () => setGeoError('Location is blocked. Allow it in your browser settings to measure from where you are.'))
    map.addControl(geo, 'top-right')
    geoRef.current = geo
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')
    map.addControl(new ToolControl([
      { id: 'layers', title: 'Map type and layers', svg: SVG('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'), onClick: () => setPanel(v => !v) },
      { id: 'measure', title: 'Measure distance', svg: SVG('<path d="M3.5 16.5l13-13 4 4-13 13z"/><path d="M7 13l1.8 1.8M9.8 10.2l1.2 1.2M12.6 7.4l1.8 1.8M15.4 4.6l1.2 1.2"/>'), onClick: () => { setProbeMode(false); setMeasuring(v => !v) } },
      ...(live.current.onProbe ? [{ id: 'probe', title: 'Probe any point with live NASA and ESA data', svg: SVG('<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'), onClick: () => { setMeasuring(false); setProbeMode(v => !v) } }] : []),
    ], tools.current), 'top-right')
    const scale = new maplibregl.ScaleControl({ maxWidth: 110, unit: live.current.prefs.units === 'mi' ? 'imperial' : 'metric' })
    map.addControl(scale, 'bottom-right')
    scaleRef.current = scale

    const show = (lat: number, lon: number) => {
      if (readout.current) readout.current.textContent = `${fmtLat(lat)}   ${fmtLon(lon)}   zoom ${map.getZoom().toFixed(1)}`
    }
    map.on('move', () => { const c = map.getCenter(); show(c.lat, c.lng) })
    map.on('mousemove', e => { const w = e.lngLat.wrap(); show(w.lat, w.lng) })
    map.on('click', 'sites', e => {
      if (live.current.measuring || live.current.probeMode) return
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) live.current.onSelect(id)
    })
    map.on('click', e => {
      const w = e.lngLat.wrap()
      if (live.current.probeMode) {
        setProbeMode(false)
        live.current.onProbe?.(w.lat, w.lng)
        return
      }
      if (!live.current.measuring) return
      setPoints(p => [...p, { lat: w.lat, lon: w.lng }])
    })
    map.on('mouseenter', 'sites', () => { if (!live.current.measuring && !live.current.probeMode) map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'sites', () => { if (!live.current.measuring && !live.current.probeMode) map.getCanvas().style.cursor = '' })

    return () => {
      clearTimeout(timer)
      for (const m of [lockMarker.current, pinMarker.current, probeMarker.current, skyMarks.current?.sun, skyMarks.current?.moon, ...labels.current]) m?.remove()
      lockMarker.current = pinMarker.current = probeMarker.current = skyMarks.current = null
      labels.current = []
      map.remove()
      mapRef.current = null
    }
  }, [date, setMe])

  // Map type, labels, night shading, units
  useEffect(() => {
    const m = mapRef.current
    if (m && ready) apply(m, prefs, streetsOk)
    scaleRef.current?.setUnit(prefs.units === 'mi' ? 'imperial' : 'metric')
  }, [prefs, ready, streetsOk])

  // Live sky: recompute every minute
  useEffect(() => {
    const id = setInterval(() => { const now = new Date(); setSky(skyAt(now)); const k = liveStamp(now); setStamp(p => (p.refresh === k.refresh ? p : k)) }, 60000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    const m = mapRef.current
    if (!m || !ready) return
    ;(m.getSource('ls-night') as GeoJSONSource | undefined)?.setData(nightBands(sky.sun))
    if (prefs.sky) {
      if (!skyMarks.current) skyMarks.current = { sun: skyMarker('sun'), moon: skyMarker('moon') }
      skyMarks.current.sun.setLngLat([sky.sun.lon, sky.sun.lat]).addTo(m)
      skyMarks.current.moon.setLngLat([sky.moon.lon, sky.moon.lat]).addTo(m)
      skyMarks.current.sun.getElement().title = `The Sun is directly overhead here right now (${fmtCoords(sky.sun.lat, sky.sun.lon, 1)})`
      skyMarks.current.moon.getElement().title = `The Moon is directly overhead here right now, ${Math.round(sky.moon.km).toLocaleString('en-US')} km away`
      syncSkyLabels(m, skyMarks.current, sky)
    } else {
      skyMarks.current?.sun.remove()
      skyMarks.current?.moon.remove()
    }
  }, [sky, ready, prefs.sky])

  // Newer orbits every hour, and a new day at the computer's midnight
  useEffect(() => {
    const m = mapRef.current
    if (!m || !ready || appliedLive.current === liveUrl) return
    appliedLive.current = liveUrl
    ;(m.getSource('ls-today') as RasterTileSource | undefined)?.setTiles([liveUrl])
  }, [liveUrl, ready])

  // Analog sites and the lock-on reticle
  useEffect(() => {
    const m = mapRef.current
    if (!m || !ready) return
    ;(m.getSource('sites') as GeoJSONSource | undefined)?.setData(sitesData(sites, selectedId, scannedIds))
    const site = sites.find(s => s.id === selectedId)
    if (!site) { lockMarker.current?.remove(); lockMarker.current = null; return }
    if (!lockMarker.current) {
      const el = document.createElement('div')
      el.className = 'site-lock'
      el.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="17"/><path d="M32 3v11M32 50v11M3 32h11M50 32h11"/></svg>'
      lockMarker.current = new maplibregl.Marker({ element: el })
    }
    lockMarker.current.setLngLat([site.lon, site.lat]).addTo(m)
    m.easeTo({ center: [site.lon, site.lat], zoom: Math.max(m.getZoom(), 3), duration: 900 })
  }, [selectedId, scannedIds, sites, ready])

  // The side panel can arm the probe tool too
  useEffect(() => {
    const arm = () => { setMeasuring(false); setPlace(null); setProbeMode(true) }
    window.addEventListener('ls-arm-probe', arm)
    return () => window.removeEventListener('ls-arm-probe', arm)
  }, [])

  // Probe tool: crosshair cursor while armed, and a pulsing ring where a live probe is running
  useEffect(() => {
    const m = mapRef.current
    tools.current.probe?.classList.toggle('is-on', probeMode)
    if (m) m.getCanvas().style.cursor = probeMode ? 'crosshair' : ''
  }, [probeMode, ready])
  useEffect(() => {
    const m = mapRef.current
    if (!m || !ready) return
    if (!probing) { probeMarker.current?.remove(); probeMarker.current = null; return }
    if (!probeMarker.current) {
      const el = document.createElement('div')
      el.className = 'probe-ping'
      probeMarker.current = new maplibregl.Marker({ element: el })
    }
    probeMarker.current.setLngLat([probing.lon, probing.lat]).addTo(m)
    m.easeTo({ center: [probing.lon, probing.lat], zoom: Math.max(m.getZoom(), 4), duration: 900 })
  }, [probing, ready])

  // Measuring: the curved line, points and a distance label on every leg
  useEffect(() => {
    const m = mapRef.current
    if (!m || !ready) return
    const line = points.length > 1 ? unwrapLon(points.flatMap((p, i) => (i === 0 ? [[p.lon, p.lat] as [number, number]] : greatCircle(points[i - 1], p).slice(1)))) : []
    ;(m.getSource('ls-measure') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: [
        ...(line.length ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: line } }] : []),
        ...points.map(p => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] } })),
      ],
    })
    labels.current.forEach(l => l.remove())
    labels.current = points.slice(1).map((p, i) => {
      const leg = greatCircle(points[i], p)
      const el = document.createElement('div')
      el.className = 'measure-label'
      el.textContent = formatDistance(distanceKm(points[i], p), prefs.units)
      return new maplibregl.Marker({ element: el }).setLngLat(leg[Math.floor(leg.length / 2)]).addTo(m)
    })
  }, [points, ready, prefs.units])

  useEffect(() => {
    const m = mapRef.current
    tools.current.measure?.classList.toggle('is-on', measuring)
    tools.current.layers?.classList.toggle('is-on', panel)
    if (m) m.getCanvas().style.cursor = measuring ? 'crosshair' : ''
  }, [measuring, panel])

  // Esc closes the measuring tool or the layers panel before anything else
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (!measuring && !panel)) return
      e.preventDefault()
      if (measuring) setMeasuring(false)
      else setPanel(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [measuring, panel])

  // Search result pin
  useEffect(() => {
    const m = mapRef.current
    if (!m || !ready) return
    if (!place) { pinMarker.current?.remove(); return }
    if (!pinMarker.current) {
      const el = document.createElement('div')
      el.className = 'place-pin'
      el.innerHTML = '<svg viewBox="0 0 26 34" aria-hidden="true"><path d="M13 1C6.4 1 1 6.3 1 12.8 1 22 13 33 13 33s12-11 12-20.2C25 6.3 19.6 1 13 1z" fill="#e9b24c" stroke="#1d1404" stroke-width="1.5"/><path d="M13 6.5l1.4 4.6 4.6 1.4-4.6 1.4L13 18.5l-1.4-4.6L7 12.5l4.6-1.4z" fill="#1d1404"/></svg>'
      pinMarker.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    }
    pinMarker.current.setLngLat([place.lon, place.lat]).addTo(m)
  }, [place, ready])

  const pick = (h: PlaceHit) => {
    setPlace(h)
    const m = mapRef.current
    if (!m) return
    if (h.bbox) m.fitBounds([[h.bbox[0], h.bbox[1]], [h.bbox[2], h.bbox[3]]], { padding: 70, maxZoom: 15, duration: 1400 })
    else m.flyTo({ center: [h.lon, h.lat], zoom: 13, duration: 1400 })
  }

  const near = place ? nearest(place, sites) : null
  const total = pathKm(points)
  const base = !streetsOk && prefs.base === 'map' ? 'blue' : prefs.base
  const time = sky.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`map-wrap is-${base}`}>
      <div ref={box} className="map" role="application" aria-label="Map of Earth with analog sites" />
      <div className="map-hud" aria-hidden="true"><span className="mh-cross" /><span className="mh-scan" /></div>
      {failed && <div className="map-fallback">This device can't draw the map. Choose a site from the list instead.</div>}

      <MapSearch onPick={pick} />

      {place && !measuring && (
        <section className="place-card cut" aria-label={`Search result: ${place.name}`}>
          <button className="pc-close" aria-label="Close" data-sfx="back" onClick={() => setPlace(null)}><Icon name="cross" size={16} /></button>
          <h3>{place.name}</h3>
          <p className="coords">{place.detail ? `${place.detail}, ` : ''}{fmtCoords(place.lat, place.lon)}</p>
          <dl className="pc-facts">
            <div>
              <dt>From you</dt>
              <dd>{me ? formatDistance(distanceKm(me, place), prefs.units) : <button className="pc-link" onClick={() => geoRef.current?.trigger()}>Use my location</button>}</dd>
            </div>
            {near && (
              <div>
                <dt>Nearest listed analog</dt>
                <dd><button className="pc-link" onClick={() => onSelect(near.item.id)}>{near.item.name}</button>, {formatDistance(near.km, prefs.units)}</dd>
              </div>
            )}
          </dl>
          <div className="pc-actions">
            {onProbe && (
              <button className="btn primary cut small" onClick={() => { const p = place; setPlace(null); onProbe(p.lat, p.lon) }}>
                <Icon name="target" size={16} />Probe here with live data
              </button>
            )}
            <button className="btn ghost cut small" onClick={() => { setPoints([{ lat: place.lat, lon: place.lon }]); setMeasuring(true) }}>
              <Icon name="ruler" size={16} />Measure from here
            </button>
          </div>
        </section>
      )}

      {panel && (
        <section className="layers-panel cut" aria-label="Map type and layers">
          <p className="lp-title">Map type</p>
          <div className="lp-bases">
            {BASES.map(b => {
              const off = b.id === 'map' && !streetsOk
              return (
                <button key={b.id} className="lp-base" aria-pressed={base === b.id} disabled={off} onClick={() => setPrefs({ base: b.id })}>
                  <span className={`lp-thumb t-${b.id}`} aria-hidden="true" />
                  <strong>{b.label}</strong>
                  <small>{off ? 'Needs an internet connection' : b.note(dateLabel)}</small>
                </button>
              )
            })}
          </div>
          <p className="lp-title">Details</p>
          <label className="lp-toggle"><input type="checkbox" checked={prefs.labels} onChange={e => setPrefs({ labels: e.target.checked })} />Place names</label>
          <label className="lp-toggle"><input type="checkbox" checked={prefs.dayNight} onChange={e => setPrefs({ dayNight: e.target.checked })} />Day and night, live</label>
          <label className="lp-toggle"><input type="checkbox" checked={prefs.sky} onChange={e => setPrefs({ sky: e.target.checked })} />Sun and Moon overhead, live</label>
          <div className="lp-units" role="group" aria-label="Distance units">
            <span>Units</span>
            <button className="seg-btn" aria-pressed={prefs.units === 'km'} onClick={() => setPrefs({ units: 'km' })}>km</button>
            <button className="seg-btn" aria-pressed={prefs.units === 'mi'} onClick={() => setPrefs({ units: 'mi' })}>miles</button>
          </div>
          <p className="lp-sky">
            Right now the Moon is {Math.round(sky.moon.km).toLocaleString('en-US')} km from Earth, overhead at {fmtCoords(sky.moon.lat, sky.moon.lon, 1)}. Updated {time}.
          </p>
        </section>
      )}

      {measuring && (
        <section className="measure-bar cut" role="status" aria-live="polite">
          {points.length < 2 ? (
            <span className="mb-hint">{points.length ? 'Tap the next point' : 'Tap the map to set points on Earth'}</span>
          ) : (
            <span className="mb-total">{formatDistance(total, prefs.units)}<small>{points.length - 1} {points.length === 2 ? 'leg' : 'legs'}</small></span>
          )}
          <div className="mb-actions">
            <button className="seg-btn" aria-pressed={prefs.units === 'km'} onClick={() => setPrefs({ units: 'km' })}>km</button>
            <button className="seg-btn" aria-pressed={prefs.units === 'mi'} onClick={() => setPrefs({ units: 'mi' })}>mi</button>
            <button className="btn ghost cut small" disabled={!points.length} data-sfx="back" onClick={() => setPoints(p => p.slice(0, -1))} aria-label="Undo last point"><Icon name="undo" size={16} /></button>
            <button className="btn ghost cut small" disabled={!points.length} data-sfx="remove" onClick={() => setPoints([])}>Clear</button>
            <button className="btn primary cut small" onClick={() => setMeasuring(false)}>Done</button>
          </div>
        </section>
      )}

      <div className="map-foot" aria-hidden="true">
        {(base === 'live' || prefs.dayNight) && (
          <span className="map-live" title={base === 'live' ? `NASA VIIRS pictures for your computer's date, ${dateLabel}, refreshed every hour. Places today's orbits have not reached yet come from the two days before; where there is no recent picture at all, such as polar night, NASA's Blue Marble shows through, dimmed.` : undefined}><span className="dot" />{base === 'live' ? `Live satellite, ${dateLabel} · ${time}` : `Live day and night, ${time}`}</span>
        )}
        <span className="map-readout" ref={readout}>20.00° N   20.00° E   zoom 1.2</span>
        <div className="legend">
          <span><i className="dot known" />Known analog</span>
          <span><i className="dot candidate" />New candidate</span>
          <span><i className="dot local" />Malaysia</span>
          <span><i className="dot discovery" />Your discoveries</span>
          <span><i className="dot scanned" />Scanned</span>
        </div>
      </div>
      {probeMode && (
        <p className="map-toast probe-toast" role="status">
          <Icon name="target" size={16} />Click anywhere on land to probe it with live NASA and ESA data.
          <button className="pc-link" onClick={() => setProbeMode(false)}>Cancel</button>
        </p>
      )}
      {geoError && <p className="map-toast" role="status">{geoError}</p>}
    </div>
  )
}
