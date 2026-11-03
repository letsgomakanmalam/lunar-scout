# Requirements: LUNAR SCOUT — Earth Analog Hunt

## Introduction
LUNAR SCOUT is a gamified web tool that helps users identify and characterize terrestrial analogs for lunar bases and landing sites using open NASA and partner-agency data. Players accept missions, compare Earth sites against lunar targets, and certify analogs. Each certification produces a transparent, data-backed analog profile.

## Glossary
- **Lunar Target**: a real Moon location of interest (e.g. Shackleton crater rim, Marius Hills pit, Apollo 15 Hadley Rille).
- **Analog Site**: an Earth location evaluated against a Lunar Target.
- **ASI (Analog Similarity Index)**: 0–100 score of how well an Analog Site matches a Lunar Target for a given mission.
- **Factor**: one measurable property used in ASI (thermal range, aridity, slope/roughness, geology, illumination, subsurface/caves, isolation, accessibility).
- **Certify**: player action that records a site as a validated analog for a mission.

## Requirements

### Requirement 1: Title & onboarding
**User Story:** As a first-time visitor, I want to understand the game in under a minute, so that I start playing immediately.

#### Acceptance Criteria
1. WHEN the site loads THE SYSTEM SHALL show a title screen with an animated Earth–Moon twin view and a single "Begin Scouting" button.
2. WHEN the player presses "Begin Scouting" for the first time THE SYSTEM SHALL run a skippable 3-step interactive tutorial (pick target → scan Earth → certify).
3. THE SYSTEM SHALL let the player skip the tutorial at any step.
4. IF the player has completed the tutorial before THEN THE SYSTEM SHALL go straight to mission selection.

### Requirement 2: Mission briefs
**User Story:** As a player, I want missions with a clear goal, so that I know what kind of analog I am looking for.

#### Acceptance Criteria
1. THE SYSTEM SHALL provide at least 6 missions, including: Polar Ice Prospecting, Lava-Tube Habitat, Regolith Rover Trials, Landing Zone Safety, Night Survival (thermal), and Impact Crater Geology.
2. EACH mission SHALL define a Lunar Target, the factors it cares about, factor weights, a minimum ASI to pass, and a narrative brief (≤ 60 words).
3. WHEN a mission is selected THE SYSTEM SHALL display the brief, the Lunar Target on the Moon globe, and the weighted factors as icons.
4. THE SYSTEM SHALL unlock missions progressively (2 open at start, more unlocked by certifications).

### Requirement 3: Twin-World View
**User Story:** As a player, I want to see the Moon target and Earth side by side, so that I can visually compare them.

#### Acceptance Criteria
1. THE SYSTEM SHALL show a Moon view and an Earth map side by side on desktop and stacked on mobile.
2. WHEN a Lunar Target is active THE SYSTEM SHALL highlight it on the Moon globe and show its factor values.
3. WHEN the player toggles "Ghost Signature" THE SYSTEM SHALL overlay an Earth heatmap showing grid-level ASI for the active mission.
4. WHEN a site is selected on Earth THE SYSTEM SHALL draw an animated "link beam" between the Earth site and the Lunar Target.

### Requirement 4: Similarity Scanner
**User Story:** As a player, I want to scan a site and get a score, so that I can judge if it is a good analog.

#### Acceptance Criteria
1. WHEN the player selects a site marker and presses Scan THE SYSTEM SHALL play a 1.5 s scanner sweep and then reveal the ASI.
2. THE SYSTEM SHALL display a radar chart comparing the site's normalized factor values against the Lunar Target.
3. EACH factor value SHALL show its source dataset name and link.
4. IF data for a factor is missing at that location THEN THE SYSTEM SHALL mark it "No data", exclude it from ASI, re-normalize weights, and show a confidence level.
5. THE SYSTEM SHALL limit scans per mission (e.g. 8 "probe charges") to encourage reasoning over clicking.

### Requirement 5: Field Kit deployment
**User Story:** As a player, I want to deploy test equipment at a site, so that I learn why site properties matter.

#### Acceptance Criteria
1. THE SYSTEM SHALL offer equipment cards: Pressurized Rover, Regolith Drill, Inflatable Habitat, Solar Array, Ice Extractor, Lander Pad.
2. WHEN equipment is deployed THE SYSTEM SHALL show a short simulated outcome (success / partial / fail) derived from the site's factors, with a one-sentence explanation.
3. Deploying mission-relevant equipment successfully SHALL add a bonus to the mission score.

### Requirement 6: Certification & debrief
**User Story:** As a player, I want to certify a site and receive a report, so that my findings are saved and shareable.

#### Acceptance Criteria
1. WHEN the player certifies a site with ASI ≥ the mission threshold THE SYSTEM SHALL mark the mission complete and award 1–3 stars based on ASI and probe efficiency.
2. IF ASI is below threshold THEN THE SYSTEM SHALL allow certification but mark it "Provisional" with reasons.
3. THE SYSTEM SHALL generate a Debrief Report: site name, coordinates, ASI, factor breakdown, strengths, weaknesses, data sources, recommended tests.
4. THE SYSTEM SHALL let the player export the report as PNG and copy a shareable link (state encoded in URL hash).

### Requirement 7: Discovery mode (new analogs)
**User Story:** As a player, I want to find analogs that are not on the famous list, so that I contribute something new.

#### Acceptance Criteria
1. THE SYSTEM SHALL allow scanning any land grid cell, not just predefined sites.
2. WHEN a scanned cell scores ASI ≥ 75 and is > 200 km from any known analog THE SYSTEM SHALL award a "New Analog Candidate" badge.
3. THE SYSTEM SHALL save discoveries locally and list them in the Codex.
4. WHERE the shared board feature flag is enabled THE SYSTEM SHALL let players submit discoveries to a public Discovery Board.

### Requirement 8: Site Codex
**User Story:** As a learner or judge, I want a reference of all sites and data, so that I can verify the science.

#### Acceptance Criteria
1. THE SYSTEM SHALL provide a Codex listing all known Earth analogs, Lunar Targets, and player discoveries.
2. EACH entry SHALL include description, coordinates, factor values, image (public domain/NASA), and citations.
3. THE SYSTEM SHALL include a "How the ASI works" page explaining the formula in plain language.

### Requirement 9: Mars extension (stretch)
**User Story:** As a player, I want to switch the target world to Mars, so that the tool supports both challenge targets.

#### Acceptance Criteria
1. WHERE the Mars flag is enabled THE SYSTEM SHALL replace the Moon globe with Mars and load Mars targets (e.g. Jezero, Gale, Arsia Mons caves).

### Requirement 10: Performance, accessibility, honesty
#### Acceptance Criteria
1. THE SYSTEM SHALL reach interactive state in < 3 s on a mid-range laptop over 4G.
2. THE SYSTEM SHALL be fully playable by keyboard and meet WCAG AA contrast.
3. THE SYSTEM SHALL show a persistent "Educational approximation — see Codex for data sources" note on score screens.
4. THE SYSTEM SHALL support sound mute and reduced-motion settings.

### Requirement 11: Submission & judging readiness
**User Story:** As the team, we want the project to meet every Space Apps rule, so that it is eligible for Local and Global Judging.

#### Acceptance Criteria
1. THE SYSTEM SHALL be deployed at a public URL before submission.
2. THE repository SHALL contain README.md, DATA_USED.md (all NASA + partner datasets with links), and AI_USE.md.
3. THE team SHALL produce a Project Demo (prepared outside this repo in the team's presentation folder) that follows the 2026 Project Submission Guide format.
4. THE app SHALL show an "About / Challenge" page stating which official challenge it answers.

### Requirement 12: Landing Site Selection
**User Story:** As a player, I want to choose where my base lands on the Moon, so that what I learned on Earth affects the game.

#### Acceptance Criteria
1. THE SYSTEM SHALL offer three landable targets: Taurus-Littrow (Easy), Marius Hills pit (Medium), Shackleton rim (Hard).
2. EACH landing site SHALL define a cost multiplier, power bonus and perks shown to the player before choosing.
3. WHILE no mission is completed THE SYSTEM SHALL disable landing selection and explain why.
4. WHEN the player changes an existing landing site THE SYSTEM SHALL ask for confirmation and clear the base.

### Requirement 13: Base Builder
**User Story:** As a player, I want to build and upgrade base modules on a lunar grid, so that I see my research turn into a base.

#### Acceptance Criteria
1. THE SYSTEM SHALL provide a 6×6 grid and modules: habitat, solar array, comms tower, science lab, ice extractor, rover garage.
2. WHEN the player places or upgrades a module THE SYSTEM SHALL deduct its cost in research points, adjusted by the landing site.
3. IF the player lacks research points or the module is locked THEN THE SYSTEM SHALL refuse and say why.
4. THE SYSTEM SHALL show power made, power used, crew space and whether the base is operational (habitat + comms + non-negative power).
5. WHEN a module is removed THE SYSTEM SHALL refund 50% of its cost.
6. Missions SHALL unlock the lab, ice extractor and rover garage.

### Requirement 14: Research Journal
**User Story:** As a player, I want a log of my findings, so that I can review and explain my choices.

#### Acceptance Criteria
1. WHEN a site is certified or a landing site is chosen THE SYSTEM SHALL add an automatic journal entry.
2. THE SYSTEM SHALL let the player add and delete their own notes.

### Requirement 15: Progress Dashboard & Leaderboard
**User Story:** As a player, I want to see my progress across sessions, so that I stay motivated.

#### Acceptance Criteria
1. THE SYSTEM SHALL persist progress in the browser between sessions.
2. THE SYSTEM SHALL show rank, stars, missions passed, sites scanned, research points, landing site and base status.
3. THE SYSTEM SHALL keep a top-10 leaderboard on the device and let the player reset progress without losing it.

### Requirement 16: Automation & phone preview
**User Story:** As the team, we want checks and previews to run automatically, so that we catch problems early and can demo on phones.

#### Acceptance Criteria
1. WHEN the dev server starts THE SYSTEM SHALL print a QR code for the network URL and save `qr-dev.png`.
2. THE repo SHALL provide `npm run qr -- <url>` to create a QR code PNG for the live site.
3. WHEN code is pushed to `main` THE CI SHALL typecheck, test, build, deploy to GitHub Pages and publish a QR code artifact.
4. Kiro hooks SHALL run tests after logic edits, data validation after data edits, and a typecheck after UI edits.

## Priority (Hackathon Scope)
- **P0 MVP (must ship):** Req 1 (simple), 2, 3.1–3.2, 4.1–4.5, 6.1–6.3, 8.3, 11, 12, 13, 14, 15.1–15.2, 16
- **P1 (if time):** 3.3 Ghost heatmap, 3.4 link beam, 5 Field Kit, 6.4 export/share, 7.1–7.3 Discovery, 15.3 leaderboard polish
- **P2 (future work, mention in pitch):** 7.4 shared board, 9 Mars mode, full Python pipeline automation
