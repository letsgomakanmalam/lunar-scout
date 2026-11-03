# Lunar Scout: Earth Analog Hunt

NASA Space Apps Challenge 2026, Kuala Lumpur. Theme: The Next Frontier.

Explore real places on Earth that behave like the Moon, pick a lunar landing site based on what you learn, and build your Moon base by completing science missions. Every score is explained and cited.

**Live site:** https://letsgomakanmalam.github.io/lunar-scout/ (updates automatically on every push to `main`)

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

## Auto-save to GitHub
Every time you start the site (`start-dev.bat` or `npm run dev`), your changes are committed with the date and time and pushed to GitHub, and the live site updates about 2 to 3 minutes later. To save without starting the site, double-click `sync-github.bat` (or run `npm run sync`). To start without saving, run `npm run dev:nosave`.

- The first time, GitHub asks you to sign in in a browser window. After that it remembers you.
- Offline? The site still starts; your changes are pushed next time.
- Everything in this folder is saved except what `.gitignore` lists, so keep passwords and private files out of it.
- If the tests fail on GitHub, the live site keeps the last working version.

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
See `DATA_USED.md`. Site values are currently team estimates based on the cited NASA and partner datasets and are labelled as estimates in the app.

## Credits
Imagery: NASA GIBS Blue Marble. Data: NASA (MODIS, POWER, NASADEM, SEDAC, LRO Diviner, LOLA, LROC, Moon Trek), USGS, GLiM, Earth Impact Database.
