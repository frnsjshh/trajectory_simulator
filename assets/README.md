# Replaceable artwork

The default side-view courier and supply crate are original local SVG assets loaded by `js/artwork.js`:

- `aircraft/courier.svg` — right-facing civilian cargo aircraft.
- `package/supply-crate.svg` — high-contrast supply crate.

Replace either file at the same path to change the default artwork. The renderer keeps the source aspect ratio and draws an isolated Canvas fallback if an asset cannot load. Optional PNG, JPG, WEBP, or SVG uploads are still available in the dashboard; **Reset art** restores the default local sprite.

Clouds, mountains, rolling hills, forests, and terrain details are procedurally drawn from deterministic profiles in `js/artwork.js`. Their shapes are lightweight, replaceable components and use the shared simulation clock. Adjust the exported asset paths or layer drawing functions there to customize the landscape; no math module depends on artwork.

All included SVG artwork is original project artwork and has no external runtime or attribution dependency.