import { SOURCES } from '../data/sources'
import { EARTH_SITES } from '../data/earthSites'
import { useGame } from '../store'

export default function About() {
  const { go } = useGame()
  return (
    <div className="page narrow">
      <header className="screen-head">
        <h1 className="screen-title">About Lunar Scout</h1>
        <p className="lede">
          Built for the NASA Space Apps Challenge 2026 in Kuala Lumpur. It answers the challenge to identify and characterize
          terrestrial analogs for future lunar bases and landing sites using open NASA and partner-agency data.
        </p>
      </header>

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

      <h2>Imagery, sound and fonts</h2>
      <p>
        The Earth map uses NASA GIBS Blue Marble tiles. The Moon and Earth on the title screen are drawn live in your browser:
        the maria and named craters such as Tycho and Copernicus sit at their real positions, and the rest of the surface is
        generated. They are illustrations, not survey data. Sounds are synthesized in the browser. Fonts: Michroma and Barlow,
        under the SIL Open Font License.
      </p>

      <button className="btn primary cut" onClick={() => go('missions')}>Go to missions</button>
    </div>
  )
}
