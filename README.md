# Vector / Flight — Linear Algebra Lab

A dependency-free, browser-first aircraft supply-drop simulator. The plotted curve, landing target, matrix operations, and falling package are all driven by the editable sensor measurements.

## Run it

- Open `index.html` directly in a modern browser, or
- Run `npm start` and visit `http://localhost:4173` for the local static server.
- Run `npm test` to execute the solver, trajectory, and simulation state tests with Node.js.

## Using the simulator

1. Edit the three sensor rows. Values recalculate when an edited field loses focus; **Recalculate model** also applies the current values immediately.
2. The matrix panel shows the original augmented matrix, the solved RREF, and each actual Gauss–Jordan row-operation snapshot. Use the step controls to inspect or play those operations.
3. Press **Start simulation**, then **Drop package** (or enable **Auto-drop**) to release the crate. Pause/resume, speed, visibility, reset, and replay controls affect the active animation.
4. Turn on presentation mode for short explanations of the calculation. Optional local sprite uploads replace the Canvas-drawn plane or package; **Reset art** restores the fallback drawings.

Quadratic interpolation requires exactly three distinct finite x-values. Additional points are intentionally rejected rather than ignored or fitted with an unstated method. A solved polynomial without a positive ground intersection, or one that does not start above ground, remains visible in the math/plot panels but will not enable a flight.

## Files

- `js/solver.js` — manually implemented Gauss–Jordan elimination with partial pivoting and row-operation snapshots.
- `js/trajectory.js` — interpolation matrix construction, polynomial evaluation, root calculation, and trajectory samples.
- `js/visualization.js` — responsive Canvas scene, default aircraft/package art, graph, target, scenery, and impact effect.
- `js/app.js` — sensor editor, dashboard updates, simulation controls/state machine, presentation text, and sprite imports.
- `assets/README.md` — artwork replacement notes. No external images or runtime packages are required.