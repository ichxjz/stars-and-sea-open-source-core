# STARS AND SEA · independent open-source core

This is an independently authored, runnable 3D Solar Atlas core. It contains nine celestial bodies, a curated sample of 18 missions, schematic orbital positions, search, time controls and selectable objects. It is **not** the complete source of the [deployed STARS AND SEA experience](https://ichxjz.com/solar/): the deployed page currently uses a third-party compiled frontend for which no redistribution license was found. The 206-record archive, 16,626-record GP snapshot, task photographs, music and the deployed UI are therefore excluded. Do not present this package as a byte-for-byte reproduction of that page.

## Run

Requires Node.js 20.19 or newer.

```bash
npm ci
npm run dev
```

Open the local URL Vite prints. `npm run build` creates `dist/`; `npm run preview` checks the production build.

The positions of mission markers, visual sizes, minor-body paths and selected moons are illustrative. Planet paths use simplified mean elements and are not suitable for navigation or scientific use. The public data and texture sources are recorded in [THIRD_PARTY.md](THIRD_PARTY.md).

## Scope and licensing

The original source code in `src/` is MIT-licensed. Planet textures in `public/solar/textures/` remain Solar System Scope's CC BY 4.0 works; keep attribution and license links in derivative deployments. Runtime npm dependencies keep their own licenses. The package intentionally excludes assets and code whose redistribution rights have not been confirmed.
