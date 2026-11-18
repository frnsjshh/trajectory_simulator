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
6. Parameter or sensor edits rebuild the model and consistently reset the flight to **READY**. Turn on presentation mode for short explanations; optional local sprite uploads replace the Canvas-drawn plane or package, and **Reset art** restores the fallback drawings.

The horizontal model is `x(t) = (v_plane + v_wind)t` and altitude is `y(t) = h − ½gt²`, with `g = 9.81 m/s²`. The three generated samples are fitted by solving `y = a₀ + a₁x + a₂x²`; the ground intersection is then obtained from those solved coefficients, not copied from the physics formula. If effective horizontal velocity is zero, the solver uses elapsed time as the independent variable and the scene shows a vertical drop. A headwind stronger than the aircraft produces a leftward landing coordinate; the result card reports its magnitude and direction.

Quadratic interpolation requires exactly three distinct finite x-values. Extra manual points are rejected rather than ignored or fit using an unstated method. Invalid or nonphysical manual polynomials remain inspectable in the math/plot panels but will not enable a flight.

## Files

- `js/solver.js` — manually implemented Gauss–Jordan elimination with partial pivoting and row-operation snapshots.
- `js/trajectory.js` — automatic physics sensor generation, interpolation matrix construction, polynomial evaluation, directional roots, and time-based package positions.
- `js/visualization.js` — responsive Canvas scene, aircraft/package art, signed/time-based graph, sensor and landing overlays, wind arrows, scenery, and impact effect.
- `js/app.js` — physical and wind controls, auto/manual sensor modes, synchronized simulation clock, dashboard toggles, presentation text, and sprite imports.
- `assets/README.md` — artwork replacement notes. No external images or runtime packages are required.