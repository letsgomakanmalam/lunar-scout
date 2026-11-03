# Product: LUNAR SCOUT — Earth Analog Hunt

## One-liner
An educational browser game: explore real places on Earth that behave like the Moon, pick a lunar landing site based on what you learn, then build your Moon base module by module by completing science missions.

## Challenge alignment (NASA Space Apps 2026)
- Identify and characterize terrestrial analogs using open Earth + Moon data.
- Present findings as an interactive map / visualization / tool.
- Each scan is a characterization: an explainable, cited Analog Similarity Index (ASI) per site and mission.

## Core loop
Missions → Analog Site Explorer (scan + certify) → research points → Landing Site Selection → Base Builder → more missions unlock more modules.

## Features
1. Analog Site Explorer: NASA Blue Marble map with known analogs, new candidates and Malaysian comparison sites.
2. Similarity Scanner: ASI score, radar chart, strengths/weak points, data confidence, cited sources.
3. Science missions: 6 missions (incl. tutorial) tied to real lunar targets; limited probes per mission.
4. Landing Site Selection: Taurus-Littrow (easy), Marius Hills pit (medium), Shackleton rim (hard), each changing costs and perks.
5. Base Builder: 6×6 lunar grid; habitat, solar array, comms, lab, ice extractor, rover garage; upgrades; power balance.
6. Research Journal: automatic entries for certifications and landing, plus player notes.
7. Progress Dashboard: rank, stars, mission log, local leaderboard.
8. Tutorial: 3-step first-run guide.
9. About page: challenge, how scoring works, site codex, data sources.

## Audience & tone
Students, judges, space fans. Understandable in 60 seconds. Fun but honest: estimates are labelled as estimates.

## Visual identity
AAA game presentation, grounded in Apollo hardware rather than generic sci-fi.
- Colour has meaning: Apollo gold foil `#e9b24c` = player actions and rewards; Earth blue `#72b6ff` = Earth and data; regolith white `#ebe6da` = the Moon. Space black `#05070d`, glass panels `#0d1320`, pass `#5fe0a2`, fail `#ff6f5e`.
- Type: Michroma (Eurostile-style, 1960s space-age) for the logo and screen titles, Barlow Condensed for HUD labels and numbers, Barlow for body text. Self-hosted in `src/assets/fonts` so the demo works offline.
- Motifs: réseau crosses (the + marks on Apollo Hasselblad photos) frame imaging surfaces; chamfered corners mark things you can act on.
- Signature moment: the title screen's live 3D Moon (real mare layout, crater relief) with the gold Earth-to-Moon trajectory.
- Game feel: HUD with animated counters, Q/E tab switching, scan sequence, "Site certified" reward screen, touchdown sequence, synthesized UI sound (M to mute). Reduced motion is respected everywhere.

## Non-goals
Not a real mission-planning tool. No accounts or servers.
