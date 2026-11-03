# Lunar Scout: Earth Analog Hunt

NASA Space Apps Challenge 2026, Kuala Lumpur. Theme: The Next Frontier.

Explore real places on Earth that behave like the Moon, pick a lunar landing site based on what you learn, and build your Moon base by completing science missions. Every score is explained and cited.

**Live site:** _add your GitHub Pages URL here_

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
- **M:** sound on or off (also in the top-right corner).

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
