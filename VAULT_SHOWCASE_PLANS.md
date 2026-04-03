# Vault — Planned Showcase Templates

Extracted from VAULT_SPEC.md. These templates are designed but not yet implemented.
Only `CharacterShowcase` (`endless-sky-character`) exists today.

All showcase templates share:
- Background: `var(--bg)` + grid texture at reduced opacity
- Section dividers: `var(--s2)` hairlines
- `[ESC]` to close; `✎/👁` toggle top-right
- Column mapping is case-insensitive + trimmed; unmatched columns fall through to EVERYTHING ELSE grid
- In edit mode: all fields gain hover affordances and become click-to-edit

---

### Place Showcase (`endless-sky-place`)

**`PlaceShowcase.jsx`** — for worlds, cities, regions, shops, landmarks.

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ESC]                                              [👁 View] [✎ Edit] │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  [Hero Image — full width, ~200px tall, object-fit: cover]      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  AETHERMOOR                                                [World]      │
│  "The City of Fractured Light"                                          │
│  [Significance tag]                                                      │
│                                                                          │
│  ▾ DESCRIPTION                                                           │
│  [rich text block]                                                       │
│                                                                          │
│  ▾ GEOGRAPHY & FEATURES                                                  │
│  [text blocks: terrain, climate, notable features, resources]            │
│                                                                          │
│  ▾ INHABITANTS & CULTURE                                                 │
│  Notable Inhabitants: [character chips]                                  │
│  Races Present: [race chips]                                             │
│  Culture: [text]    Government: [text]                                   │
│                                                                          │
│  ▾ CONNECTIONS                                                           │
│  Connected Places: [place chips]    Parent Region: [chip]               │
│                                                                          │
│  ▾ GALLERY                                                               │
│  [image thumbnails]                                                      │
│                                                                          │
│  ▾ EVERYTHING ELSE                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Column mapping
| Column pattern | Placement |
|-------|-----------|
| Name | Large heading |
| Type / Place Type | Chip top-right (World, City, Shop, etc.) |
| Significance | Colored tag |
| Description / Lore / Notes | Rich text block |
| Image / Art / Banner | Hero image (full-width banner) |
| Terrain / Climate / Features / Resources | Geography section text blocks |
| Inhabitants / Notable Characters | Relation chips → character showcases |
| Races / Races Present | Relation chips |
| Culture / Government | Text blocks |
| Connected Places / Nearby / Parent Region | Relation chips → place showcases |
| Gallery / Images | Image gallery grid |

---

### Race Showcase (`endless-sky-race`)

**`RaceShowcase.jsx`**

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ESC]                                              [👁 View] [✎ Edit] │
│                                                                          │
│  ┌───────────────┐  ┌──────────────────────────────────────────────┐   │
│  │ [Race Art]    │  │  HALF-ELF                                    │   │
│  │               │  │  [Significance tag]                          │   │
│  │               │  │  Lifespan: ~300 years   Rarity: Uncommon     │   │
│  └───────────────┘  └──────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ DESCRIPTION & ORIGIN                                                  │
│  [rich text block]                                                       │
│                                                                          │
│  ▾ PHYSICAL TRAITS                                                       │
│  [text: build, distinguishing features, size range]                      │
│                                                                          │
│  ▾ INNATE ABILITIES                                                      │
│  [text or chips: natural powers, racial passives]                        │
│                                                                          │
│  ▾ CULTURE & SOCIETY                                                     │
│  [text: values, traditions, governance]                                  │
│                                                                          │
│  ▾ NOTABLE MEMBERS                                                       │
│  [character relation chips]                                              │
│                                                                          │
│  ▾ HOME WORLD                                                            │
│  [place relation chip]                                                   │
│                                                                          │
│  ▾ EVERYTHING ELSE                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Ability Showcase (`endless-sky-ability`)

**`AbilityShowcase.jsx`**

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ESC]                                              [👁 View] [✎ Edit] │
│                                                                          │
│  STARFALL NOVA                                                           │
│  [Active]  ·  [Fire Element]  ·  Cost: 80 MP                           │
│  [S-Rank]                                                                │
│                                                                          │
│  ▾ DESCRIPTION                                                           │
│  [rich text: what it does, what it looks like]                           │
│                                                                          │
│  ▾ EFFECTS & MECHANICS                                                   │
│  [text: damage, range, cooldown, scaling]                                │
│                                                                          │
│  ▾ PREREQUISITES                                                         │
│  [text or chips: level req, stat req, ability tree]                      │
│                                                                          │
│  ▾ KNOWN USERS                                                           │
│  [character relation chips]                                              │
│                                                                          │
│  ▾ EVERYTHING ELSE                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Item / Weapon Showcase (`endless-sky-item`)

**`ItemShowcase.jsx`**

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ESC]                                              [👁 View] [✎ Edit] │
│                                                                          │
│  ┌───────────────┐  ┌──────────────────────────────────────────────┐   │
│  │ [Item Art]    │  │  MOONVEIL KATANA                             │   │
│  │               │  │  [Legendary]  ·  [Weapon — Sword]            │   │
│  │               │  │                                              │   │
│  │               │  │  Owner: [character chip]                     │   │
│  └───────────────┘  └──────────────────────────────────────────────┘   │
│                                                                          │
│  ▾ DESCRIPTION & LORE                                                    │
│  [rich text block]                                                       │
│                                                                          │
│  ▾ STATS & EFFECTS                                                       │
│  [text/numbers: damage, bonuses, special effects]                        │
│                                                                          │
│  ▾ ORIGIN                                                                │
│  [text: who made it, where it was found]                                │
│                                                                          │
│  ▾ EVERYTHING ELSE                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Magic System Showcase (`endless-sky-magic-system`)

**`MagicSystemShowcase.jsx`**

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ESC]                                              [👁 View] [✎ Edit] │
│                                                                          │
│  AETHER WEAVING                                                          │
│  [Core System]                                                           │
│                                                                          │
│  ▾ OVERVIEW                                                              │
│  [rich text: what this magic system is, how it works]                    │
│                                                                          │
│  ▾ RULES & LIMITATIONS                                                   │
│  [text: costs, consequences, hard limits]                                │
│                                                                          │
│  ▾ ELEMENTS / SCHOOLS                                                    │
│  [relation chips → element showcases]                                    │
│                                                                          │
│  ▾ RELATED ABILITIES                                                     │
│  [relation chips → ability showcases]                                    │
│                                                                          │
│  ▾ EVERYTHING ELSE                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Magic Element Showcase (`endless-sky-element`)

**`ElementShowcase.jsx`**

#### Layout
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ESC]                                              [👁 View] [✎ Edit] │
│                                                                          │
│  🔥 FIRE                                                                │
│  [color swatch in element color]                                         │
│                                                                          │
│  ▾ DESCRIPTION                                                           │
│  [rich text: nature of this element, philosophy]                         │
│                                                                          │
│  ▾ STRENGTHS & WEAKNESSES                                                │
│  Strong against: [element chips]                                        │
│  Weak against: [element chips]                                          │
│                                                                          │
│  ▾ RELATED ABILITIES                                                     │
│  [ability relation chips]                                                │
│                                                                          │
│  ▾ NOTABLE USERS                                                         │
│  [character relation chips]                                              │
│                                                                          │
│  ▾ EVERYTHING ELSE                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```
