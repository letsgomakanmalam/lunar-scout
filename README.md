# Analog Scout: Earth twins for the Moon Base and Mars

NASA Space Apps Challenge 2026, Kuala Lumpur. Theme: The Next Frontier.

Find and characterize places on Earth that behave like NASA's Moon Base site at the lunar south pole and like the first base sites on Mars. Probe any point on Earth with live NASA and ESA data, plan field campaigns with the Twin finder, then land on the Moon or Mars and build your base. Every score is explained and cited.

Built for the NASA Space Apps Challenge 2026 challenge **"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"**. The app was renamed from Lunar Scout to Analog Scout because it now covers Mars; the repository, live URL and save key stay `lunar-scout`. To change the name, edit `src/brand.ts`.

**Live site:** https://letsgomakanmalam.github.io/lunar-scout/ (updates automatically on every push to `main`)

## What it does
- **Real targets on two worlds.** The Moon: NASA's Moon Base site on the Shackleton Connecting Ridge, the Artemis III candidate regions at Malapert Massif and Mons Mouton, and the Marius Hills lava-tube pit. Mars: the SWIM buried-ice regions (Arcadia Planitia, Deuteronilus Mensae) and rover sites from NASA (Jezero, Gale), ESA (Oxia Planum) and CNSA (Utopia Planitia), plus the Arsia Mons cave skylights.
- **30 Earth sites, 13 factors each**: deserts, polar regions, volcanic fields, caves, impact craters, acidic waters, salt basins and highlands. Known analogs, under-used candidates (including two in Indonesia near Kuala Lumpur) and Malaysian comparison sites. New factors: ground ice, highland rock (anorthosite, the rock of the lunar south pole), bare ground, water-laid rock and salts, and low polar Sun.
- **Probe any point on Earth** (crosshair button on the map, or "Probe here" on a search result). The app reads NASA POWER climate, ESA Copernicus DEM terrain, NASA MODIS vegetation, the Macrostrat geologic map and the Earth Impact Database for that spot, scores it against every Moon and Mars target, and flags a **new analog candidate** when it scores 75+ more than 200 km from any listed analog.
- **Global search for new analogs** (Twin finder): every land cell on Earth (91,636 cells of 0.5°) is scored against the chosen Moon or Mars site and shown as a world heatmap. The best places that are not yet known analogs are ranked, each with a one-tap live probe, and a validation check shows where the analogs agencies already use fall (for most sites, in the top 10% of Earth's land). See **FINDINGS.md** for the results: for NASA's Moon Base ridge, the top five new candidates all contain impact structures in polar tundra (El'gygytgyn, Pingualuit, Popigai, Tunnunik and the buried Hiawatha structure).
- **Twin finder**: pick any Moon or Mars site to see its best Earth twins, the best three-site field campaign (greedy maximum coverage), and what no place on Earth can copy (gravity, air, radiation, temperature, day length, dust) with how teams test those instead.
- **South-pole light calendar**: the dates when the Sun at an Earth site stays as low as at the lunar south pole. NASA fakes this lighting with spotlights at night; this finds where and when the real Sun does it.
- **Reports**: download an Analog Passport (Markdown and JSON) for any site, or a twin report for any Moon or Mars site.
- **Judge mode**: the Missions screen has a switch that opens all 13 missions at once.

## Rebuild the global search and findings
- `npm run grid` (needs Python with `pip install kgcpy geonamescache scipy numpy pillow` and an internet connection for Natural Earth and the volcano list) rebuilds `public/data/earth-grid.bin` and `.json` from open data. See the top of `scripts/build-earth-grid.py` for exactly what goes in.
- `npm run findings` regenerates `FINDINGS.md` from that grid with the app's own scoring code.
- How climate zones turn into factors is one editable table: `src/data/climateZones.ts` (also shown on the About screen).

## Replace estimates with measured values
With an internet connection, run `npm run measure` (or `npm run measure -- --only=atacama,svalbard`). It measures temperature swing, dryness, extreme cold, slope and roughness, and bare ground for every listed site and writes `src/data/measured.json`; the app then shows those values as measured instead of estimated. Then run `npm test`: the data tests check that every mission can still be passed. Rock type, ground ice and craters stay as reviewed estimates, because one map point can miss what a site is known for; use **Check against live data** on any site to compare them.

## Run it on Windows (easiest)
1. Install **Node.js LTS** from https://nodejs.org (version 20 or newer).
2. Double-click **`start-dev.bat`**.
3. A QR code appears in the window. Scan it with your phone (same Wi-Fi) to open the site. The same code is saved as `qr-dev.png`.
   If your phone can't connect, allow Node.js through Windows Firewall on **Private** networks.

## Run it from a terminal (Kiro, VS Code, Mac, Linux)
```bash
npm install
npm run dev        # site + QR code for your phone
npm run check      # typecheck + tests + build
```

## Controls
- **Main menu:** arrow keys to choose, Enter to select.
- **Q / E:** previous / next tab. **Esc:** back to the main menu.
- **1 to 6:** pick a module on the Base screen.
- **N:** music on or off. **M:** sound effects on or off (both also in the top-right corner).

## Building your base
The Base screen is a 3D Moon base on a highland plateau. Drag to turn the view, scroll or pinch to zoom, and tap a plot to build.
- **Energy** pays for buildings and refills over time, even while the game is closed. Solar arrays and landing pads refill it faster; battery banks store more.
- **Score**: buildings score more next to good neighbours (a greenhouse farm next to a habitat, oxygen next to ice) and less next to bad ones (rocket dust from landing pads, radio noise near the telescope). The number over a plot shows what you would score. Each score target on the ring gives energy and research points.
- **Quests** (the + button) give rewards. **Technology** needs quests done, then research points, and unlocks new buildings: greenhouse farm, battery bank, landing pad, oxygen plant, regolith printer and radio telescope. Missions still unlock the rover garage, science lab and ice extractor.
- Number keys 1 to 9 pick a building; **2D plan** gives a flat, keyboard-friendly view.

## Opening animation
When the site opens, the camera zooms from the edge of the observable universe through the Milky Way and the Solar System to Earth and the Moon, then lands on the title screen. It is also the loading screen: the Moon's surface is generated meanwhile. Any key, click or tap skips it, and devices set to reduce motion skip it automatically. To freeze one moment for a screenshot or slide, open the site with `?intro-at=2.3` (seconds) at the end of the address.

## Your 24/7 link
Your site is online all the time at **https://letsgomakanmalam.github.io/lunar-scout/**, even when your computer is off.
After every save, the window waits until GitHub has published the update, then shows the link with a QR code, copies it to your clipboard (paste it into WhatsApp or anywhere) and opens it in your browser. Double-click `live-link.bat` (or run `npm run live`) to get the link any time.

## Auto-save to GitHub
Every time you start the site (`start-dev.bat` or `npm run dev`), your changes are committed with the date and time and pushed to GitHub, and the live site updates about 2 to 3 minutes later. To save without starting the site, double-click `sync-github.bat` (or run `npm run sync`). To start without saving, run `npm run dev:nosave`.

- The first time, GitHub asks you to sign in in a browser window. After that it remembers you.
- Offline? The site still starts; your changes are pushed next time.
- Everything in this folder is saved except what `.gitignore` lists, so keep passwords and private files out of it.
- If the tests fail on GitHub, the live site keeps the last working version.

## Earth map
The Explore Earth map works like Google Maps:
- **Map types** (layers button): *Live Earth* (NASA's latest daily satellite picture, sharpening into Sentinel-2 detail as you zoom), *Satellite* (Sentinel-2, 10 m), *Map* (streets and places from OpenStreetMap) and *Blue Marble*.
- **Search** any place, and use the **location** button to show where you are. Each search result shows how far it is from you, its nearest listed analog, and a **Probe here** button.
- **Probe** (crosshair button): click any point on land to characterize it with live NASA and ESA data. Your discoveries appear as teal markers.
- **Measure** (ruler button): tap points on Earth to get distances along the curved Earth, in km or miles.
- **Live**: the day and night shadow, and where the Sun and the Moon are directly overhead, update every minute.
No API keys are needed. Search and map tiles need an internet connection; the game itself still works offline with imagery only.

## Tutorial
New players get a guided tour: Mission Control highlights the real buttons and moves on when you do each step (scan, certify, land, build). Replay it from the title screen (**Tutorial**) or the About page. The steps live in `src/data/tutorial.ts`.

## Music and sound
The soundtrack is original and generated in the browser (`src/lib/music.ts`), so there are no audio files to download or licence. Music and sound effects have separate switches on the title screen and in the top bar. To use your own track instead, put it in `public/music/` and set `CUSTOM_TRACK` in `src/lib/music.ts`. Only use music you have the rights to.

## Phones, tablets and big screens
Phones (portrait and landscape), tablets, laptops and large monitors each get their own layout. On touch screens, scroll the page with one finger and move the map with two. Low-power devices draw the title Moon at a lower resolution.

## Put it online with a QR code
1. Create a GitHub repo and push this folder to the `main` branch.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` tests, builds and deploys. Open the **Actions** run, then download the **site-qr** artifact for the QR image.
4. Or make one yourself: `npm run qr -- https://your-name.github.io/your-repo/`

## Project layout
See `.kiro/steering/structure.md`. Specs are in `.kiro/specs/lunar-analog-game/`, automation hooks in `.kiro/hooks/`.

## Data
See `DATA_USED.md`. Low polar Sun is computed; live probes measure their values directly; the other listed-site values are team estimates read from the cited datasets until `npm run measure` replaces them, and the app labels every estimate.

## Credits
Data: NASA (POWER, MODIS via the ORNL DAAC, NASADEM, SEDAC, NSIDC, LRO LOLA/Diviner/LROC, Moon Trek and Mars Trek, MGS MOLA, MRO HiRISE and CRISM, Mars Odyssey THEMIS, SWIM, Curiosity, Perseverance, GIBS), ESA (Copernicus DEM, Mars Express, ExoMars), JAXA (Kaguya), ISRO (Chandrayaan-2, HOPE), CNSA (Tianwen-1, Chang'e 4), Canadian Space Agency, USGS, Macrostrat, GLiM, Earth Impact Database. Imagery: NASA GIBS, EOX Sentinel-2 cloudless, OpenFreeMap.
