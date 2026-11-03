import { SOURCES } from '../data/sources'
import { EARTH_SITES } from '../data/earthSites'
import { useGame } from '../store'
import Icon, { type IconName } from '../components/Icon'

const LOOP: { icon: IconName; title: string; text: string }[] = [
  { icon: 'rocket', title: 'Take a mission', text: 'Each mission names a place on the Moon and what matters there.' },
  { icon: 'globe', title: 'Scan Earth', text: 'Scan real places with NASA data. Certify one that is Moon-like enough to earn research points.' },
  { icon: 'flag', title: 'Land', text: 'Choose where on the Moon to land. Each site changes costs and perks.' },
  { icon: 'grid', title: 'Build', text: 'Spend points on modules. Passing missions unlocks new ones.' },
]

const KEYS: [string, string][] = [
  ['↑ ↓  Enter', 'Move through the main menu'],
  ['Q  E', 'Previous and next tab'],
  ['1 to 6', 'Pick a module on the Base screen'],
  ['N', 'Music on or off'],
  ['M', 'Sound effects on or off'],
  ['Esc', 'Back to the main menu, or close a window'],
]

export default function About() {
  const { go, startTutorial } = useGame()
  return (
    <div className="page narrow">
      <header className="screen-head">
        <h1 className="screen-title">About Lunar Scout</h1>
        <p className="lede">
          Built for the NASA Space Apps Challenge 2026 in Kuala Lumpur. It answers the challenge to identify and characterize
          terrestrial analogs for future lunar bases and landing sites using open NASA and partner-agency data.
        </p>
      </header>

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
        Each site gets an Analog Similarity Index (ASI) from 0 to 100 for the current mission. We describe every site with eight
        factors, such as dryness and rock type, each scaled from 0 to 1. A 1 means "as Moon-like as anywhere on Earth gets".
        The Moon is more extreme than Earth on almost everything, so its value is set to the most extreme Earth level.
      </p>
      <div className="formula cut">
        <p><var>similarity</var> = 1 − | <var>site value</var> − <var>Moon value</var> |</p>
        <p><var>ASI</var> = 100 × Σ ( <var>weight</var> × <var>similarity</var> ) ÷ Σ <var>weight</var></p>
      </div>
      <p>
        For each factor the mission cares about, similarity is 1 minus the gap between the site and the Moon target. The ASI is
        the weighted average of those similarities, times 100. If a factor has no data, it is left out and the other weights are
        rescaled. The data confidence figure tells you how much of the mission's weight had data.
      </p>
      <p>
        Current site values are team estimates read from the cited datasets. They are an educational approximation, not a
        mission-planning tool.
      </p>

      <h2>Sites</h2>
      <ul className="codex">
        {EARTH_SITES.map(s => (
          <li key={s.id} className={`st-${s.status}`}>
            <strong>{s.name}</strong>
            <span className="coords">{s.country}</span>
            <p>{s.description}</p>
          </li>
        ))}
      </ul>

      <h2>Data sources</h2>
      <ul className="sources">
        {SOURCES.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> ({s.agency})</li>)}
      </ul>

      <h2>Imagery, music and fonts</h2>
      <p>
        The Earth map shows NASA's latest daily satellite picture of the whole planet (VIIRS on NOAA-20, through NASA GIBS),
        Sentinel-2 cloudless imagery by EOX (contains modified Copernicus Sentinel data, free for non-commercial use), the
        OpenFreeMap street map (OpenStreetMap data) and NASA's Blue Marble. Place search uses Photon by Komoot, which only
        receives what you type. Your location stays on your device: it is used to show distances and is never saved or sent.
        Day, night and the Sun and Moon positions are worked out in your browser every minute. The Moon and Earth on the title screen are drawn live in your browser:
        the maria and named craters such as Tycho and Copernicus sit at their real positions, and the rest of the surface is
        generated. They are illustrations, not survey data. The music and sounds are original and synthesized in the browser.
        Fonts: Michroma and Barlow, under the SIL Open Font License.
      </p>

      <button className="btn ghost cut" onClick={() => go('missions')}>Go to missions</button>
    </div>
  )
}
