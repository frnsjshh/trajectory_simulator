# `mathUtils.js` flow diagram

`js/mathUtils.js` is a pure math module: it does not start an animation or touch the DOM. On load, its wrapper creates the API, makes it available as `TrajectoryMathUtils` in a browser (and `module.exports` in Node), and then waits for another module to call one of its exported methods.

The simulator's main calculation normally starts with `generatePhysicsModel(parameters)`. Manual mode instead starts with `fitQuadratic(sensorPoints)`. Both paths reach the same curve-fitting and linear-system solver.

```mermaid
flowchart TD
    load["mathUtils.js loads\nIIFE creates API\nconstants: DEFAULT_TOLERANCE, STANDARD_GRAVITY"] --> exports["Exports pure utility methods\n(no calculation runs until a caller invokes one)"]

    app["App / trajectory wrapper"] --> choice{"Input route"}
    choice -->|Normal simulation parameters| physics["generatePhysicsModel(parameters)"]
    choice -->|Manual three sensor readings| fit["fitQuadratic(sensorPoints)"]

    physics --> validateParams["Convert and validate\nspeed, altitude, gravity, wind"]
    validateParams --> flightTime["calculateFlightTime\nt_f = sqrt(2h / g)"]
    validateParams --> velocity["Effective horizontal speed\nv_eff = v_aircraft + signed wind"]
    flightTime --> basis{"abs(v_eff) < 1e-10?"}
    velocity --> basis
    basis -->|No: distance basis| sampleDistance["Sample at 0.2, 0.5, 0.8 of t_f\nx = v_eff t\ny = h - 1/2 g t²"]
    basis -->|Yes: vertical drop / time basis| sampleTime["Sample at 0.2, 0.5, 0.8 of t_f\nx = t\ny = h - 1/2 g t²"]
    sampleDistance --> fit
    sampleTime --> fit

    fit --> validatePoints["Require exactly 3 finite points\nwith distinct x values"]
    validatePoints --> vandermonde["buildVandermondeMatrix\nA rows = [1, x, x²]\nB = y values"]
    vandermonde --> solve["solveLinearSystem(A, B)"]
    solve --> augment["augmentMatrix → [A | B]\nrecord starting snapshot"]
    augment --> pivotLoop["For each column k\nchoose largest abs pivot\n(partial pivoting)"]
    pivotLoop --> singular{"Pivot > scaled tolerance?"}
    singular -->|No| error["Throw: singular or ill-conditioned\n(use distinct, well-spread x values)"]
    singular -->|Yes| rowOps["Swap rows if needed\nnormalize pivot row\neliminate all other rows\nrecord each snapshot"]
    rowOps --> more{"More columns?"}
    more -->|Yes| pivotLoop
    more -->|No| rref["Clean floating-point residuals\nRREF = [I | X]\nX = [a₀, a₁, a₂]"]

    rref --> roots["findPolynomialRoots(coefficients)\nΔ = a₁² - 4a₂a₀\nCitardauq stable root formula"]
    roots --> fitted["Fitted model\npoints, A, B, coefficients, roots, RREF, audit steps"]
    fitted --> landing["generatePhysicsModel adds physical metadata\nflight time, landing time, landing X, distance"]
    fitted --> manualModel["Manual caller supplies remaining model metadata"]

    landing --> consumers["Animation, graph, solver panel, viewport"]
    manualModel --> consumers
```

## Main mathematical pipeline

| Stage | Method(s) | Calculation / result |
| --- | --- | --- |
| Physics setup | `calculateFlightTime`, `calculateEffectiveHorizontalSpeed` | Computes `t_f = sqrt(2h/g)` and `v_eff = v_aircraft ± v_wind`. `generatePhysicsModel` performs these calculations inline for its final model. |
| Physical sample generation | `calculateKinematicPosition` (standalone helper), `generatePhysicsModel` | Uses `x(t) = v_eff t` and `y(t) = h - ½gt²`. The model generator creates samples at 20%, 50%, and 80% of flight time. |
| Quadratic reconstruction | `buildVandermondeMatrix`, `fitQuadratic` | Forms `A X = B`, where `X = [a₀, a₁, a₂]^T` and `y = a₀ + a₁x + a₂x²`. |
| Linear solve | `augmentMatrix`, `cloneMatrix`, `swapRows`, `solveLinearSystem`, `formatNumber` | Reduces `[A | B]` to `[I | X]` with partial pivoting. Every meaningful row operation is copied into `steps` for the UI audit trail. |
| Landing prediction | `findPolynomialRoots` / alias `findPositiveRoot` | Finds real roots of the fitted polynomial. It uses the stable Citardauq form and chooses a forward root; `generatePhysicsModel` selects the root in the physical direction of travel. |

## What happens after the model is solved

```mermaid
flowchart LR
    model["Solved trajectory model\ncoefficients + roots + flight metadata"] --> motion["Motion methods"]
    model --> draw["Drawing / viewport methods"]
    model --> checks["Validation / presentation"]

    motion --> pos["positionAtTime(model, elapsed)\nclamp time → x → y = P(x)"]
    motion --> progress["trajectoryPosition(model, progress)\nclamp progress → x → y = P(x)"]
    motion --> samples["sampleTrajectory(coefficients, endX)\npoints for smooth curve"]

    draw --> domain["measureSceneDomain\ninclude origin, landing, sensors, plane, vertex"]
    domain --> viewport["createSceneViewport\nworld metres → canvas pixels"]
    viewport --> transform["x_screen = left + worldX · xScale\ny_screen = groundY - altitude · yScale"]

    checks --> flightCheck["validateFlightPath\npositive launch altitude + forward root\n30 samples must stay above ground"]
    checks --> label["formatPolynomialText\nrender y = a₀ + a₁x + a₂x²"]
```

`evaluatePolynomial(coefficients, x)` (and its alias `evaluate`) is the shared low-level operation in those downstream paths. It evaluates the curve with Horner form:

```text
P(x) = a₀ + x(a₁ + a₂x)
```

`calculateParabolaVertex` supports scene sizing by finding the curve's peak/valley. The remaining independent helpers support rendering and UI behavior: vector/matrix primitives (`createVector`, `dotProduct`, `matrixVectorMultiply`, etc.), `positiveModulo` for scrolling, `exponentialDecayBlend` for camera smoothing, and `niceScaleTick` for readable ruler intervals.

## Start points at a glance

- **Application startup:** the module only defines constants and returns its public API.
- **Normal simulation:** `app.js` calls the trajectory wrapper's `generatePhysicsModel(parameters)`, which delegates to this file.
- **Manual sensor simulation:** `app.js` calls `fitQuadratic(points)` through the wrapper.
- **Each animation frame:** `positionAtTime(model, elapsed)` calculates the package location; viewport functions project it to pixels.

