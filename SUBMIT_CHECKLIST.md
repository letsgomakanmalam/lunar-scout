# Before you submit (Team Dua Orang)

Do these in order. Each one is something only the team can do.

## 1. Test on a real internet connection (10 minutes)
- [ ] Run `start-dev.bat`, open Explore Earth, press the probe button and probe one desert point.
- [ ] After scanning, check that **Wind & blowing dust** and **Limits of life** show a value. If wind says "no data", the rest still works: tell the judges wind comes from the listed-site estimates only.
- [ ] Open one site, open **Look closer with space agency data** and click each link once.
- [ ] Run `npm run measure`, then `npm test`. This replaces estimates with measured values.

## 2. Review what was written on 14 November
- [ ] Wind and limits-of-life values for the 30 sites (`src/data/earthSites.ts`).
- [ ] The nature explanations (`src/lib/baseNature.ts`) and the astronomy and engineering notes marked "background" (`src/data/knowledge.ts`).
- [ ] Process labels for sites and targets (`processes:` in `earthSites.ts` and `targets.ts`).
- [ ] The Mars rankings changed for Jezero, Gale and Utopia: update any slide that quotes them.

## 3. Put the new version online
- [ ] Double-click `sync-github.bat` (or push to `main`). Wait for the green tick under Actions.
- [ ] Open https://letsgomakanmalam.github.io/lunar-scout/ in a private window and check the About page shows "Team Dua Orang".

## 4. Submit on the Space Apps platform
- [ ] Re-read the official challenge page and the 2026 Project Submission Guide.
- [ ] Project demo (required). A 60-second order that shows relevance first:
  1. Twin finder, Moon Base ridge: best Earth twins and shared processes. Press **Why?** on Haughton Crater, then compare it with Kamestastin ("use both").
  2. "Search the whole planet": the heatmap and one new candidate (FINDINGS.md).
  3. Explore Earth: probe that candidate live with NASA and ESA data.
  4. Switch to Mars (Gale): Qaidam Basin, wind and salt processes, what Earth cannot copy.
  5. Analog within reach: from Kuala Lumpur, Western Australia is 79% as good as the Atacama and five times closer. This is the team's own idea, so say so.
  6. Last 10 seconds only: the living base. Press a building to pin its explanation in 3D, then Life > Nature at the base > Show me a dust storm (land on Mars first).
- [ ] Paste `DATA_USED.md` and `AI_USE.md` into the project page.
- [ ] Tick the terms checkbox and submit before the deadline.
