# Third-party notices

- Planet textures in `public/solar/textures/`: © Solar System Scope / INOVE, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Original texture collection](https://www.solarsystemscope.com/textures/). They were resized for web display; credit and a link to the license must remain when redistributed.
- React, React DOM, Three.js, Vite and the Vite React plugin are installed through npm and retain their own licenses; this repository does not vendor their source.
- Mission and planet descriptions are newly written short summaries of public facts. [NASA Science](https://science.nasa.gov/solar-system/) is a research reference; no NASA endorsement is implied.

This package does not contain the deployed HUMAN ARTIFACTS / solar-system-atlas.pages.dev frontend bundle or Worker, its task images, its compiled CSS, the CelesTrak snapshot, or the album's audio files. Their rights are not granted by this repository's MIT license.

The eight `docs/demos/online-*.gif` recordings show the final full online site. The Earth surface includes Solar System Scope imagery (CC BY 4.0); orbital elements are from CelesTrak and positions are propagated, not telemetry. They carry a fixed author/scope caption and do not distribute GP datasets or upstream source.

The independent Earth view uses satellite.js 6.0.2 (MIT, installed through npm). No compiled third-party atlas worker is copied. Its GP provider is requested at runtime, subject to that provider's access terms and availability; OpenStreetMap and Esri raster tiles are also requested at runtime and are not bundled. The browser regression fixture is synthetic and labelled as such.
