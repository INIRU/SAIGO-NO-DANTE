# Design System: SAIGO NO DANTE

## Scope

This document is the durable visual contract for public SAIGO NO DANTE web
surfaces, especially dense tool pages such as deck builder, deck detail, Mirror
Dungeon planner, gift planning, and selection modals.

It complements `docs/conventions.md`. Runtime components still follow the
approved feature specs, accessibility rules, localization rules, and existing
component ownership boundaries.

## Visual Tone

The site should feel like a compact Limbus archive command board: dark, flat,
framed, asset-led, and built for repeated scanning. Game art and official-like
asset frames carry the visual identity. Web chrome stays restrained.

Preferred qualities:

- flat dark surfaces with thin gold/brown borders;
- dense but readable tool layouts;
- crisp dividers, rails, framed cells, and board grids;
- visible game assets as the primary decoration;
- clear active, selected, disabled, and empty states.

Avoid decorative polish that looks generated or detached from the game UI:

- no decorative CSS gradients, purple/blue AI gradients, bokeh, glowing orbs,
  or abstract blobs;
- no fake 3D panels, bevel-heavy controls, glossy overlays, or dramatic inner
  shadows;
- no broad marketing hero cards on builder/tool pages;
- no nested card stacks where a divider, rail, or simple surface would work;
- no card-sized empty areas that contain only a tiny icon and weak label.

## Typography

Use the existing project font system:

- body: SCDream with Pretendard/system fallback;
- compact data and numeric text: `font-mono`;
- brand/page titles: KotraBold only where a display title is intended;
- repeated utility labels may use KotraBold family only if local text stroke is
  removed or reduced.

Perception scale:

- display page title: 48-56px desktop (`3rem-3.5rem`), 34-40px mobile
  (`2.125rem-2.5rem`);
- section title: 24-32px (`1.5rem-2rem`);
- tool label, tab, button: 15-16px (`0.9375rem-1rem`);
- metadata/counter: 14px (`0.875rem`);
- caption below 12px (`0.75rem`) is allowed only for non-critical decoration.

Repeated card names, empty slot labels, modal card names, and compact tabs must
not use the global `.font-serif` stroke unchanged. The target is readable game
flavor, not crushed title weight.

Font weight ceilings by rendered text size:

| Rendered size | Common use | Max weight |
| --- | --- | --- |
| 12px / `0.75rem` | non-critical captions only | 600 |
| 13-14px / `0.8125rem-0.875rem` | metadata, card sublabels, counters | 600 |
| 15-16px / `0.9375rem-1rem` | nav labels, tabs, buttons, compact controls | 700 only for active/primary state; otherwise 500-600 |
| 17-20px / `1.0625rem-1.25rem` | emphasized row labels, small panel titles | 700 |
| 21-32px / `1.3125rem-2rem` | section titles, modal titles | 700; 800 only when the font renders cleanly |
| 34px+ / `2.125rem+` | page/display titles | display face allowed, but do not add extra stroke to compact UI |

KotraBold and other title faces should be treated as visually heavier than
their numeric CSS weight. Below 20px they should normally render at `400` with
`-webkit-text-stroke: 0 transparent`; use `.font-compact-serif` or an equivalent
local style instead of global `.font-serif`. Small Korean nav/card labels that
become muddy at 700+ must step down one weight before increasing font size.
Home route labels, Command Map metadata, deck/planner passive rows, and compact
selection controls follow the same ceiling: raise unreadable 10-12px labels to
the allowed caption/metadata scale before using heavier weights.

Use tabular numbers for counters, slots, and resource totals. Long English and
Japanese labels must wrap, clamp, or fade intentionally. Text clipping inside a
button, tab, card, modal header, or chip is a bug.

## Color And Tokens

Use existing dark/gold roles:

- page background: `#0d0b08`;
- primary tool surface: `#1a1510`;
- inset/board surface: near-black warm brown;
- gold accent: `#c8900a`;
- light gold: `#e8b030`;
- dark gold: `#8a6010`;
- sin colors: existing `sin.*` tokens and keyword icon/color helpers.

Gold is an accent, not a fill for every border. Secondary controls should use
lower-contrast borders and become stronger only when selected or focused.

Functional image scrims are allowed only when they keep real game art readable.
They should be subtle, local to the image, and should not become a visible
decorative gradient surface. Prefer flat `rgba(...)` overlays, thin dividers,
or solid inset surfaces for builder chrome.

## Layout Grammar

Builder and planner pages are workbenches, not landing pages. The first screen
must prioritize the working board.

Deck/planner builder thresholds:

- desktop `1440x1050`: the main board or first row of useful work cells should
  begin within about 420px of the viewport top;
- mobile `390x844`: at least one row of real work cells should be visible in
  the first viewport after the global header;
- top title, description, actions, inputs, and content type controls together
  should stay within roughly 280-340px desktop and 420-520px mobile unless the
  user is in a long-form editor.

Do not make every repeated item a card. Use these roles:

- board cell: fixed aspect repeated slot, light frame, stable dimensions;
- tool strip: compact controls, no large card padding;
- panel: one level of grouping for an actual editor or inventory;
- modal: separate interaction layer with scroll lock and clear close affordance.

Avoid stacked panels inside panels. Use line dividers, section labels, sticky
headers, rails, or grouped spacing before adding another card container.

## Controls

Hit areas:

- all user-triggered controls: at least 44px (`2.75rem`) effective hit target;
- mobile primary touch controls: prefer 48px (`3rem`);
- visual boxes may be smaller only when the hit area is expanded invisibly.

Button hierarchy:

- one primary action per area;
- secondary actions use flatter borders and quieter text;
- content-type chips and filters are not primary CTAs;
- active state should be visible without glow or fake depth.

Tabs:

- desktop tabs can be icon plus label;
- mobile tabs must keep either a short visible label or an unmistakable
  accessible compact label;
- counters such as `12` must be visually tied to the tab purpose, not floating
  as unexplained badges.

## Board And Card Surfaces

Formation boards should use stable grid tracks and fixed-format cells. Empty
slots are board cells, not blank giant cards.

Empty slot contract:

- show sinner/slot icon, localized name, and a clear affordance;
- keep internal contrast strong enough to read on mobile;
- avoid large dead space;
- preserve the same cell dimensions before and after selection to prevent
  layout shifts.

Deck detail's 6/2 formation-board direction is the preferred desktop reference.
Mirror Dungeon/planner cards can use richer game-asset material, but the web
container around them should stay flat and compact.

## Modals

Modals are interaction layers, not page sections.

Requirements:

- body/page scroll is separated from modal body scroll;
- close control remains above card decorations;
- card stars, hover overlays, and badges cannot draw over the modal header;
- header text must fit in Korean, English, and Japanese;
- mobile modal body has internal scrolling and a visible close affordance;
- opening and closing should preserve focus and avoid jumping the page.

Selection modals may use sticky search/filter controls when the option list is
long. Search and filter chrome must be compact enough that the first row of
results is visible quickly.

## Localization And Data

All public UI text must render through `ko`, `en`, and `ja` message keys or the
existing data-localization helpers.

User-facing data must prefer localized fields when available:

- identity names;
- E.G.O names and skill/effect text;
- sinner names;
- passive names/descriptions;
- keyword labels;
- E.G.O gift names/effects;
- content-type labels.

Canonical Korean names may remain as saved keys and matching tokens, but they
must not leak into `/en` or `/ja` display surfaces when localized data exists.
Fallback dashes such as `-` in place of localized names are not acceptable for
primary card labels.

## Accessibility

Every interactive card must have a clear accessible name that includes the
current action when the visual label is compact. Direct-card add/remove/toggle
interactions should use `aria-label`/`title` rather than visible instruction
text under every card.

Focus states must be visible. Reduced-motion preferences must be respected for
hover/lift animations. No important information should depend only on color.

## QA Standard

Visual changes to public builder/planner pages require screenshots at minimum:

- `ko`, `en`, `ja`;
- desktop around `1440x1050`;
- mobile around `390x844`;
- at least one open modal state for selection-heavy surfaces.

Record:

- screenshot paths;
- `documentElement.scrollWidth` versus `clientWidth`;
- first useful work-cell Y position;
- console errors/warnings;
- notable hit-area measurements;
- any remaining localization fallback.

Screenshots are evidence. If a named screenshot says "modal", the modal chrome
must actually be visible in the screenshot.
