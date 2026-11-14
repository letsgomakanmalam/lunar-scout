/**
 * The data portals the challenge lists as resources, opened at (or near) a place on Earth.
 * These are links for a closer look by a person; the app does not read data from them.
 * RADARSAT and G-Portal need a free account, so they open at their front page.
 */
export interface AgencyLink { name: string; url: string; note: string }

export function agencyLinks(lat: number, lon: number): AgencyLink[] {
  const half = 1.5
  const w = Math.max(-180, lon - half * 2), e = Math.min(180, lon + half * 2), s = Math.max(-90, lat - half), n = Math.min(90, lat + half)
  const f = (v: number) => v.toFixed(3)
  return [
    { name: 'NASA Worldview', url: `https://worldview.earthdata.nasa.gov/?v=${f(w)},${f(s)},${f(e)},${f(n)}`, note: 'Daily satellite pictures of this place' },
    { name: 'NASA Earthdata Search', url: `https://search.earthdata.nasa.gov/search?sp[0]=${f(lon)}%2C${f(lat)}`, note: 'Every NASA Earth dataset covering this point' },
    { name: 'ESA Copernicus Browser', url: `https://browser.dataspace.copernicus.eu/?zoom=11&lat=${f(lat)}&lng=${f(lon)}`, note: 'Sentinel radar and optical images' },
    { name: 'CSA RADARSAT (EODMS)', url: 'https://www.eodms-sgdot.nrcan-rncan.gc.ca/', note: 'Canadian radar images; free account needed' },
    { name: 'JAXA G-Portal', url: 'https://gportal.jaxa.jp/gpr/', note: 'Japanese rain, snow and vegetation data; free account needed' },
  ]
}
