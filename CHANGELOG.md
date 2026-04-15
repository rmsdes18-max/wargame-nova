# Changelog

## [v2.1.0] - 2026-04-15

### Added
- Weave-inspired design system (Figma Make audit -> CSS)
- design-tokens.css v2 with new color palette
- Full component audit tab in playground with CSS classes
- Inter font as primary body font
- Permissions section in CLAUDE.md

### Changed
- Accent color: #f0c040 (gold) -> #d4e157 (lime-green)
- Background: #1e1f22 -> #0a0a0a (true dark)
- Card bg: #2b2d31 -> #1a1a1a
- Borders: #3f4147 -> #2a2a2a
- Body font: Plus Jakarta Sans -> Inter
- Border radius: unified to 12/8/4px (card/btn/badge)
- Component heights: 32/40/48px (sm/md/lg)
- All legacy CSS variables aliased for backward compatibility

## [v2.0.0] - 2026-04-15

### Added
- 7 componente: role-badge, stats-row, party-card, modal, member-dropdown, toast, empty-state
- 3 utils: api.js, party-helpers.js, dom.js
- 5 page modules: smart-match.js, war-view.js, members.js, settings.js, new-war.js
- CLAUDE.md cu style guide
- Playground pentru testare componente

### Changed
- index.html: 7000 -> 897 linii (shared state + HTML only)
- Extract smart-match.js (676 linii) — SM3 stats matching UI
- Extract war-view.js (860 linii) — wars list, viewWar, drag-drop, edit mode
- Extract members.js (887 linii) — roster page, CSV import, member profile, aliases
- Extract settings.js (477 linii) — auth, guild management, guild settings, users
- Extract new-war.js (1377 linii) — wizard steps 1-5, vision/OCR, save
- 55+ duplicate eliminate
- 30 alert() -> Toast
- 30+ fetch() -> apiGet/apiPost/apiPut/apiPatch/apiDelete
- 9+ inline role color objects -> roleColor()/roleHex()
- 4 party dot color arrays -> PARTY_DOT_COLORS
- 2 inline modals -> Modal.inline()
- 7 empty state blocks -> EmptyState()
