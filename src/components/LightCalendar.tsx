import { grazingDays, lightWindows, LOW_SUN_DEG } from '../lib/sun'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STARTS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]

/** Day numbers grouped into [start, end] runs, for drawing. */
function runs(days: number[]): [number, number][] {
  const out: [number, number][] = []
  for (const d of days) {
    const last = out[out.length - 1]
    if (last && d === last[1] + 1) last[1] = d
    else out.push([d, d])
  }
  return out
}

/**
 * A year strip showing when the Sun stays as low as at the lunar south pole at one Earth place.
 * Blue: below 7° all day (south polar rims and plateaus). Gold: as low as the chosen Moon site.
 */
export default function LightCalendar({ lat, maxDeg, targetName }: { lat: number; maxDeg: number; targetName: string }) {
  const broad = grazingDays(lat, LOW_SUN_DEG)
  const tight = grazingDays(lat, maxDeg)
  const w1 = lightWindows(lat, LOW_SUN_DEG)
  const w2 = lightWindows(lat, maxDeg)
  const label = w1.length
    ? `Low-Sun days at latitude ${lat.toFixed(1)}: ${w1.map(w => w.label).join(', ')}`
    : `The Sun never stays below ${LOW_SUN_DEG} degrees all day at this latitude`
  return (
    <figure className="light-cal">
      <svg viewBox="0 0 365 22" preserveAspectRatio="none" role="img" aria-label={label}>
        <rect x="0" y="0" width="365" height="22" className="lcal-bg" />
        {runs(broad).map(([a, b]) => <rect key={`b${a}`} x={a - 1} y="3" width={b - a + 1} height="16" className="lcal-broad" />)}
        {runs(tight).map(([a, b]) => <rect key={`t${a}`} x={a - 1} y="3" width={b - a + 1} height="16" className="lcal-tight" />)}
        {STARTS.slice(1).map(d => <line key={d} x1={d - 1} x2={d - 1} y1="0" y2="22" className="lcal-tick" />)}
      </svg>
      <div className="lcal-months" aria-hidden="true">{MONTHS.map(m => <span key={m}>{m}</span>)}</div>
      <figcaption>
        {w1.length
          ? <><span className="lcal-key broad" />Sun below {LOW_SUN_DEG}° all day: <strong>{w1.map(w => w.label).join('; ')}</strong></>
          : <>The noon Sun never stays below {LOW_SUN_DEG}° here, so south-pole light needs spotlights, as NASA does at night.</>}
        {w1.length > 0 && (
          w2.length
            ? <><br /><span className="lcal-key tight" />As low as at {targetName} (below {maxDeg.toFixed(1)}°): <strong>{w2.map(w => w.label).join('; ')}</strong></>
            : <><br />Never quite as low as at {targetName} (below {maxDeg.toFixed(1)}°).</>
        )}
      </figcaption>
    </figure>
  )
}
