import { SOURCES } from '../data/sources'
import { EARTH_SITES, MEASURED, measuredShare } from '../data/earthSites'
import { TARGETS } from '../data/targets'
import { FACTOR_HINTS, FACTOR_KEYS, FACTOR_LABELS, type Agency } from '../data/types'
import { CLIMATE_ZONES } from '../data/climateZones'
import { useGame } from '../store'
import Icon, { type IconName } from '../components/Icon'
import { APP_NAME } from '../brand'

const LOOP: { icon: IconName; title: string; text: string }[] = [
  { icon: 'rocket', title: 'Take a mission', text: "Each mission names a real base or landing site on the Moon or Mars, and what matters there." },
  { icon: 'globe', title: 'Scan Earth', text: 'Scan listed places, or probe any point with live data. Certify one that is close enough to earn research points.' },
  { icon: 'twins', title: 'Plan with twins', text: 'The Twin finder ranks Earth twins for every site and builds the best three-site field campaign.' },
  { icon: 'flag', title: 'Land and build', text: 'Choose a landing site on the Moon or Mars. Each changes costs and perks. Spend points on modules.' },
]

const ANSWERS: { icon: IconName; ask: string; answer: string }[] = [
  { icon: 'target', ask: 'Permanent Moon base locations and Mars', answer: `${TARGETS.length} real targets: NASA's Moon Base on the Shackleton Connecting Ridge, Artemis III candidate regions at Malapert Massif and Mons Mouton, and a lava-tube pit on the Moon; SWIM ice regions and NASA, ESA and CNSA rover sites on Mars.` },
  { icon: 'search', ask: 'Identify new terrestrial analogs', answer: "The Global search screens all 91,636 land cells on Earth (0.5°) against every Moon and Mars site, ranks the best places that are not yet known analogs, and checks itself against the analogs agencies already use. One tap then probes a candidate live. FINDINGS.md lists what it found." },
  { icon: 'layers', ask: 'Characterize them', answer: 'Every site has 13 factors with the measurement, source and an estimate flag. The Analog Passport exports it all as Markdown and JSON.' },
  { icon: 'globe', ask: 'Deserts, polar regions, volcanic and arid terrain, caves and more', answer: `${EARTH_SITES.length} listed sites across desert, polar, volcanic, cave, impact, highland, water-laid and acidic environments.` },
  { icon: 'signal', ask: 'Open data from NASA and other space agencies', answer: 'NASA POWER, MODIS, LRO, SWIM, THEMIS, Curiosity and Perseverance; ESA Copernicus DEM, Mars Express and ExoMars; JAXA Kaguya; ISRO Chandrayaan-2 and HOPE; CNSA Tianwen-1 and Chang\'e 4; CSA analogue missions.' },
  { icon: 'chart', ask: 'Present it as a map, visualization or tool', answer: 'A live Earth map, Moon and Mars globes, radar charts, a south-pole light calendar, the Twin finder and downloadable reports.' },
]

const KEYS: [string, string][] = [
  ['↑ ↓  Enter', 'Move through the main menu'],
  ['Q  E', 'Previous and next tab'],
  ['1 to 6', 'Pick a module on the Base screen'],
  ['N', 'Music on or off'],
  ['M', 'Sound effects on or off'],
  ['Esc', 'Back to the main menu, or close a window'],
]

const AGENCY_ORDER: Agency[] = ['NASA', 'ESA', 'JAXA', 'ISRO', 'CNSA', 'CSA', 'USGS', 'Other']

export default function About() {
  const { go, startTutorial } = useGame()
  const share = Math.round(measuredShare() * 100)
  return (
    <div className="page narrow">
      <header className="screen-head">
        <h1 className="screen-title">About {APP_NAME}</h1>
        <p className="lede">
          Built for the NASA Space Apps Challenge 2026 in Kuala Lumpur, for the challenge "Identify Earth Locations that Analog the
          Permanent Moon Base Locations and Mars". It finds and characterizes places on Earth where crews and machines can
          rehearse for the Moon Base at the lunar south pole and for the first bases on Mars.
        </p>
      </header>

      <h2>How it answers the challenge</h2>
      <ul className="answers">
        {ANSWERS.map(a => (
          <li key={a.ask} className="cut">
            <Icon name={a.icon} size={22} />
            <strong>{a.ask}</strong>
            <p>{a.answer}</p>
          </li>
        ))}
      </ul>

      <h2>How to play</h2>
      <ol className="howto">
        {LOOP.map((s, i) => (
          <li key={s.title} className="cut">
            <span className="howto-no" aria-hidden="true">{i + 1}</span>
            <Icon name={s.icon} size={26} />
            <strong>{s.title}</strong>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <button className="btn primary cut" onClick={startTutorial}><Icon name="play" size={16} />Play the guided tutorial</button>

      <h2>Controls</h2>
      <p>Everything works by tapping or clicking. On a keyboard you can also use:</p>
      <dl className="keys">
        {KEYS.map(([k, d]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>)}
      </dl>

      <h2>How scoring works</h2>
      <p>
        Each site gets an Analog Similarity Index (ASI) from 0 to 100. Sites are described by 13 factors, each scaled from 0 to 1,
        where 1 means "as Moon- or Mars-like as anywhere on Earth gets". The Moon and Mars are more extreme than Earth on almost
        everything, so a target's value is set to the most extreme Earth level.
      </p>
      <div className="formula cut">
        <p><var>similarity</var> = 1 − | <var>site value</var> − <var>target value</var> |</p>
        <p><var>ASI</var> = 100 × Σ ( <var>weight</var> × <var>similarity</var> ) ÷ Σ <var>weight</var></p>
      </div>
      <p>
        Missions weight the factors they care about; the Twin finder uses each target's crew profile. Factors without data are left
        out and the other weights are rescaled. Data confidence shows how much of the weight had data.
      </p>
      <dl className="factor-defs">
        {FACTOR_KEYS.map(k => <div key={k}><dt>{FACTOR_LABELS[k]}</dt><dd>{FACTOR_HINTS[k]}</dd></div>)}
      </dl>
      <h3 className="sub-h">Live probe scales</h3>
      <p>
        A probe turns open data into factors with fixed, published scales: daily temperature swing 5 °C = 0 to 20 °C = 1 (NASA
        POWER); mean annual temperature 10 °C = 0 to −20 °C = 1 for cold; rain as e<sup>−mm/450</sup> for dryness; ground ice
        from mean annual temperature (permafrost below about −2 °C); local relief over 4 km, 500 m = 1 (Copernicus DEM); peak-season
        NDVI 0.45 = 0 to 0.10 = 1 for bare ground (MODIS); rock type from the geologic map unit (Macrostrat); impact craters from
        distance to confirmed structures, weighted by age (Earth Impact Database). Low polar Sun is computed from latitude: days a
        year when the Sun rises but stays below 7°.
      </p>
      <h3 className="sub-h">Global search</h3>
      <p>
        A grid of 0.5° cells (about 55 km) covers all land. Each cell gets a Köppen-Geiger climate zone (Rubel et al., 1986–2010,
        100 arc-second map), the distance to the nearest town of 1,000+ people (GeoNames), impact structures (Earth Impact Database),
        young volcanoes (Smithsonian Global Volcanism Program) and salt flats and glaciers (Natural Earth). Climate zones become
        screening proxies for dryness, cold, temperature swing, ground ice and bare ground (table below); ice sheets count as
        ice-covered, not bare, because the Moon and Mars have exposed rock. Each cell's score is the ASI over the factors it has.
        Candidates are the best cells at least 300 km from every listed analog and 450 km from each other. As a check, the app shows
        where the known analogs for each site fall among all land cells: for most sites they rank in the top 10%.
      </p>
      <details>
        <summary>Climate zone proxies</summary>
        <div className="table-scroll">
          <table className="zone-table">
            <thead><tr><th>Zone</th><th>Climate</th><th>Dryness</th><th>Cold</th><th>Swing</th><th>Ice</th><th>Bare</th></tr></thead>
            <tbody>{CLIMATE_ZONES.slice(1).map(z => <tr key={z.code}><th scope="row">{z.code}</th><td>{z.label}</td><td>{z.aridity}</td><td>{z.cold}</td><td>{z.thermal}</td><td>{z.ice}</td><td>{z.barren}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      <h3 className="sub-h">Field campaigns</h3>
      <p>
        Coverage of a set of sites is Σ <var>weight</var> × (best similarity in the set) ÷ Σ <var>weight</var>. The planner adds,
        one at a time, the site that raises coverage most (greedy maximum coverage).
      </p>

      <h2>Honest limits</h2>
      <p>
        {share > 0
          ? `${share}% of the listed site values are measured or computed${MEASURED.generated ? ` (measured on ${MEASURED.generated.slice(0, 10)})` : ''}; the rest are team estimates read from the cited datasets, and are labelled as estimates wherever they appear.`
          : 'Most listed site values are team estimates read from the cited datasets, and are labelled as estimates wherever they appear. Low polar Sun is computed. Live probes and the live data check measure values directly.'}
        {' '}Caves are not measured live; remoteness comes from the global grid. Global search values are coarse screening proxies for a whole cell, so every candidate needs a live probe and, ideally, a field visit. No place on Earth copies low gravity, vacuum or space radiation: the Twin
        finder lists these gaps and how teams test them instead. This is an educational screening tool, not a mission-planning product.
      </p>

      <h2>Sites</h2>
      <ul className="codex">
        {EARTH_SITES.map(s => (
          <li key={s.id} className={`st-${s.status}`}>
            <strong>{s.name}</strong>
            <span className="coords">{s.country}{s.analogUse ? ` · ${s.analogUse}` : ''}</span>
            <p>{s.description}</p>
          </li>
        ))}
      </ul>

      <h2>Data sources by agency</h2>
      {AGENCY_ORDER.map(a => {
        const list = SOURCES.filter(s => s.agency === a)
        if (!list.length) return null
        return (
          <div key={a} className="agency-block">
            <h3 className="sub-h">{a === 'Other' ? 'Other open data' : a}</h3>
            <ul className="sources">
              {list.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>)}
            </ul>
          </div>
        )
      })}

      <h2>Imagery, privacy, music and fonts</h2>
      <p>
        The Earth map shows NASA's latest daily satellite picture of the whole planet (VIIRS on NOAA-20, through NASA GIBS),
        Sentinel-2 cloudless imagery by EOX (contains modified Copernicus Sentinel data, free for non-commercial use), the
        OpenFreeMap street map (OpenStreetMap data) and NASA's Blue Marble. Place search and probe place names use Photon by Komoot.
        When you probe a point, only its coordinates are sent to NASA POWER, Open-Meteo, the ORNL DAAC MODIS service, Macrostrat and
        Photon. Your own location stays on your device: it is used to show distances and is never saved or sent. The Moon, Mars and
        Earth globes are drawn live in your browser: maria, craters, volcanoes and basins sit at their real positions and the rest of
        the surface is generated. They are illustrations, not survey data. The music and sounds are original and synthesized in the
        browser. Fonts: Michroma and Barlow, under the SIL Open Font License.
      </p>

      <div className="report-row">
        <button className="btn ghost cut" onClick={() => go('missions')}>Go to missions</button>
        <button className="btn ghost cut" onClick={() => go('twins')}><Icon name="twins" size={16} />Open the Twin finder</button>
      </div>
    </div>
  )
}
