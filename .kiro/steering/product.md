# Product: ANALOG SCOUT — Earth twins for the Moon Base and Mars (repo: lunar-scout)

## One-liner
An educational browser game and planning tool: find and characterize places on Earth that behave like NASA's Moon Base site at the lunar south pole and the first base sites on Mars, probe any point with live NASA and ESA data, then land on the Moon or Mars and build a base.

## Challenge alignment (NASA Space Apps 2026)
- Challenge: "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars".
- Identify and characterize terrestrial analogs using open Earth, Moon and Mars data from NASA and other agencies (ESA, JAXA, ISRO, CNSA, CSA).
- New analogs: live probe of any point; 75+ ASI and 200+ km from listed analogs = new analog candidate.
- Present findings as an interactive map / visualization / tool.
- Each scan is a characterization: an explainable, cited Analog Similarity Index (ASI) per site and mission.

## Core loop
Missions → Analog Site Explorer (scan + certify) → research points → Landing Site Selection → Base Builder → more missions unlock more modules.

## Features
1. Analog Site Explorer: NASA Blue Marble map with known analogs, new candidates and Malaysian comparison sites.
2. Similarity Scanner: ASI score, radar chart, strengths/weak points, data confidence, cited sources.
3. Science missions: 13 missions in two tracks (Moon south-pole base: 7, Mars: 6) tied to real targets; limited probes per mission; judge mode opens all.
4. Landing Site Selection: Moon (Mons Mouton plateau easy, Malapert Massif medium, Marius Hills pit medium, Shackleton Connecting Ridge hard) and Mars (Arcadia Planitia medium, Jezero hard), each with data-driven costs and perks.
5. Base Builder: 6×6 lunar grid; habitat, solar array, comms, lab, ice extractor, rover garage; upgrades; power balance.
6. Research Journal: automatic entries for certifications and landing, plus player notes.
7. Progress Dashboard: rank, stars, mission log, local leaderboard.
8. Tutorial: guided tour of the whole loop (scan, certify, land, build) that spotlights the real controls and advances on player actions; replayable from the title and About.
9. About page: how to play, controls, challenge, how scoring works, site codex, data sources.
10. Soundtrack: original generative music (busier on the title, calmer in game) plus UI sound effects, with separate on/off switches.
11. Earth map like Google Maps: Live Earth (NASA VIIRS daily), Sentinel-2 satellite, OpenFreeMap streets, Blue Marble; place search; my location; distance measuring along the curved Earth; live day and night with Sun and Moon overhead; distance from you to each site and the nearest analog to any place.
12. New game from the main menu (keeps settings and the leaderboard).
13. Opening zoom from the observable universe to Earth and the Moon, which doubles as the loading screen.
14. 3D low-poly base builder: energy that refills over time, neighbour scoring with score targets, quests that unlock technology, and 12 buildings including a greenhouse farm. Moon, cosy-sea and Mars looks.
15. Live probe: characterize any point on Earth from NASA POWER, Copernicus DEM, MODIS NDVI, Macrostrat and the Earth Impact Database (src/lib/probe.ts, probeFetch.ts).
16. Twin finder: best Earth twins per Moon or Mars site, three-site campaign planner, reality gaps, twin report (src/screens/Twins.tsx, src/lib/twins.ts).
17. South-pole light calendar: dates when an Earth site's Sun stays as low as at the lunar south pole (src/lib/sun.ts).
18. Analog Passport: Markdown and JSON characterization report for any site (src/lib/passport.ts).
19. `npm run measure`: replaces estimated climate, terrain and vegetation values with measured ones (scripts/measure-sites.ts → src/data/measured.json).

## Audience & tone
Students, judges, space fans. Understandable in 60 seconds. Fun but honest: estimates are labelled as estimates.

## Visual identity
AAA game presentation, grounded in Apollo hardware rather than generic sci-fi.
- Colour has meaning: Apollo gold foil `#e9b24c` = player actions and rewards; Earth blue `#72b6ff` = Earth and data; regolith white `#ebe6da` = the Moon; rust `#e07a4f` = Mars; teal `#4fe3d0` = the player's live discoveries. Space black `#05070d`, glass panels `#0d1320`, pass `#5fe0a2`, fail `#ff6f5e`.
- Type: Michroma (Eurostile-style, 1960s space-age) for the logo and screen titles, Barlow Condensed for HUD labels and numbers, Barlow for body text. Self-hosted in `src/assets/fonts` so the demo works offline.
- Motifs: four-point star glints frame imaging surfaces and twinkle in the sky, and shooting stars cross the title screen; chamfered corners mark things you can act on.
- Signature moment: the title screen's live 3D Moon (real mare layout, crater relief) with the gold Earth-to-Moon trajectory.
- Game feel: HUD with animated counters, Q/E tab switching, scan sequence, "Site certified" reward screen, touchdown sequence, synthesized UI sound (M to mute). Reduced motion is respected everywhere.

## Non-goals
Not a real mission-planning tool. No accounts or servers.
