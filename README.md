# Vector / Flight — Linear Algebra Lab

A dependency-free, browser-first aircraft supply-drop simulator. Aircraft and wind parameters generate the sensor readings; a manually implemented Gauss–Jordan solver reconstructs the polynomial used by the graph, landing prediction, and falling package.

## Run it

- Open `index.html` directly in a modern browser, or
- Run `npm start` and visit `http://localhost:4173` for the local static server.
- Run `npm test` to execute the solver, trajectory, and simulation state tests with Node.js.

## Using the simulator

1. Adjust aircraft speed (5–120 m/s) and release altitude (10–200 m). The readouts and flight model use these actual parameter values.
2. Wind is optional (0–20 m/s): tailwind adds to the horizontal velocity and headwind subtracts from it. The model assumes constant horizontal wind velocity and neglects drag.
3. By default, three sensor points are generated at sample times during the fall. They form the displayed matrix; its row operations and solution come from the custom Gauss–Jordan solver. Use **Manual mode** to edit exactly three readings, or load the original sample (`(0,45)`, `(1,40)`, `(2,25)`) for an interpolation demonstration.
4. Press **Start simulation**, then **Drop package** (or enable **Auto-drop**). The aircraft moves at its selected speed; the package inherits the plane-plus-wind horizontal velocity and follows the polynomial reconstructed from the generated samples. Pause/resume, simulation speed, visibility, reset, and replay controls affect the shared animation clock.
5. The visualization menu independently hides the scene curve, graph, matrix, sensor markers/labels, landing marker, wind arrows, and equation/results. These presentation toggles do not recalculate or reset the flight.
6. Choose **Explain** to open the presentation popup over the live scene. Previous/Next move one step; Play waits for aircraft movement, package release, landing, and the real Gauss–Jordan row-operation playback before entering event-gated steps. Presentation Pause freezes its timer and matrix animation, closing it leaves the flight untouched, and Restart returns to step 1.
7. The fullscreen control expands the complete simulation cockpit, keeping the flight controls, parameter sliders, wind settings, visualizations, and presentation access available. The scene camera recomputes on resize/fullscreen without changing the model or package position; scroll the cockpit if the viewport is shorter than its controls.
8. While ready, parameter edits rebuild the sensor model and smoothly adjust the camera. During flight, aircraft/wind changes are queued for **Reset** or **Replay**, with an on-screen notice, so an active drop never changes physics or zoom unexpectedly. Manual sensor edits or switching sensor modes rebuild the model and return to **READY**. Optional local sprite uploads replace the Canvas-drawn plane or package, and **Reset art** restores the fallback drawings.

The horizontal model is `x(t) = (v_plane + v_wind)t` and altitude is `y(t) = h − ½gt²`, with `g = 9.81 m/s²`. The three generated samples are fitted by solving `y = a₀ + a₁x + a₂x²`; the ground intersection is then obtained from those solved coefficients, not copied from the physics formula. If effective horizontal velocity is zero, the solver uses elapsed time as the independent variable and the scene shows a vertical drop. A headwind stronger than the aircraft produces a leftward landing coordinate; the result card reports its magnitude and direction.

The adaptive camera fits the complete signed trajectory, sensor samples, a pre-release flight lane, and landing margins. It freezes its world range during an active flight; resizing or fullscreen changes only the screen mapping. Aircraft and crate artwork keep readable screen sizes independently of the physical distance scale. Clouds, hills, varied trees, wind, and ground details share the simulation clock and continue through landing; Pause freezes them together.

Quadratic interpolation requires exactly three distinct finite x-values. Extra manual points are rejected rather than ignored or fit using an unstated method. Invalid or nonphysical manual polynomials remain inspectable in the math/plot panels but will not enable a flight.

## Files

- `js/solver.js` — manually implemented Gauss–Jordan elimination with partial pivoting and row-operation snapshots.
- `js/trajectory.js` — automatic physics sensor generation, interpolation matrix construction, polynomial evaluation, directional roots, and time-based package positions.
- `js/artwork.js` — replaceable local plane/crate sprites, Canvas fallbacks, and lightweight, deterministic cloud/mountain/forest/terrain parallax layers.
- `js/visualization.js` — responsive Canvas scene, shared world-to-screen camera, adaptive route bounds, sensor/landing overlays, synchronized scene/graph, wind arrows, and impact effect.
- `js/app.js` — physical and wind controls, auto/manual sensor modes, synchronized simulation clock, sequential event-gated presentation controller, fullscreen cockpit, dashboard toggles, and sprite imports.
- `assets/aircraft/courier.svg`, `assets/package/supply-crate.svg`, and `assets/README.md` — original replaceable artwork and customization notes. No external images or runtime packages are required.