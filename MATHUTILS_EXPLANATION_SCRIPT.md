# `mathUtils.js` overview — presentation script

## Opening

> `mathUtils.js` is the simulator's pure mathematical engine. It has no buttons, DOM updates, canvas drawing, or animation code. Its responsibility is to receive numerical inputs, calculate a physically meaningful flight path, solve the polynomial behind that path, and provide the results to the rest of the application.

> The most important idea is that the module starts with either flight parameters or three sensor readings. It turns those values into a quadratic equation, uses Gauss-Jordan elimination to solve the equation, predicts the landing point, and then supplies position and viewport calculations for the animation.

## 1. Module setup and constants

> At the top, the file uses a wrapper that supports both environments. In the browser, it exposes the API as `TrajectoryMathUtils`; in Node.js, it exports the same API for tests and other modules.

> It also defines two shared constants: `DEFAULT_TOLERANCE`, which is `1e-12`, and `STANDARD_GRAVITY`, which is `9.81 metres per second squared`. The tolerance helps the module distinguish real values from tiny floating-point rounding errors. The gravity constant is the default acceleration used in the flight equations.

## 2. Vector methods

> The first group contains basic vector operations: `createVector`, `vectorAdd`, `vectorSubtract`, `vectorScale`, `dotProduct`, and `vectorNorm`.

> These methods are general linear-algebra building blocks. For example, `vectorAdd` and `vectorSubtract` combine or compare coordinate values component by component. `vectorScale` multiplies every component by a scalar. `dotProduct` multiplies matching components and adds them together, while `vectorNorm` calculates a vector's Euclidean length.

> In this simulator, these functions provide reusable mathematical foundations. They also make the code easier to test because each operation has one focused responsibility.

## 3. Matrix and row-operation methods

> The next group prepares the data for solving systems of equations. `createMatrix` creates a two-dimensional numeric array, and `cloneMatrix` creates a safe copy so earlier solver states are not accidentally changed.

> `augmentMatrix` combines the coefficient matrix `A` and the value vector `B` into the augmented form `[A | B]`. This is the standard form used by Gauss-Jordan elimination.

> `matrixVectorMultiply` calculates `A times x`, which is useful for checking that a solved answer reproduces the original values. The row-operation methods — `swapRows`, `scaleRow`, and `addScaledRow` — represent the three legal elementary row operations used in linear algebra.

> These methods are important because they make the solver explainable. Instead of treating the solve as a black box, the application can show the transformations that lead from `[A | B]` to the answer.

## 4. `solveLinearSystem`: the core solver

> `solveLinearSystem` is the central linear-algebra method. Its job is to solve `A times X equals B` using Gauss-Jordan elimination with partial pivoting.

> First, it validates that `A` is a non-empty square matrix, that `B` has the matching length, and that the tolerance is valid. It then constructs `[A | B]` and stores the first matrix snapshot in an audit trail called `steps`.

> For every column, the solver finds the row with the largest absolute pivot value. This is called partial pivoting. It improves numerical stability because dividing by a very small value can magnify floating-point errors.

> Next, it swaps the best pivot row into place if necessary, divides the pivot row so that the pivot becomes one, and eliminates that column from every other row. Repeating those operations transforms the matrix into reduced row echelon form: `[I | X]`.

> Finally, the method cleans very small rounding residuals to zero and reads the last column as the solution vector `X`. It returns the final RREF matrix, the solution, and the recorded row-operation steps. If the sensor matrix is singular or nearly singular, it raises a clear error instead of returning a misleading answer.

## 5. Polynomial evaluation and landing roots

> The simulator models the trajectory as a quadratic polynomial: `y equals a0 plus a1 x plus a2 x squared`.

> `evaluatePolynomial`, also available through the alias `evaluate`, calculates the altitude at a given input value. It uses Horner form: `a0 plus x times (a1 plus a2 times x)`. This is both compact and numerically reliable.

> `calculateParabolaVertex` finds the peak or valley of the trajectory. It uses `x vertex equals negative a1 divided by 2a2`, then evaluates the polynomial at that location. The camera uses this information so a high arc is not cropped.

> `findPolynomialRoots`, also available through the alias `findPositiveRoot`, finds where the trajectory reaches ground level, meaning where `y equals zero`. It checks linear edge cases, tests the discriminant, and uses the numerically stable Citardauq form of the quadratic formula. It returns all real roots and identifies the smallest positive root as a candidate forward landing point.

## 6. Curve fitting: `buildVandermondeMatrix` and `fitQuadratic`

> `fitQuadratic` is the main entry point when the application has three sensor readings. Each reading is an `x, y` coordinate on the flight path.

> The method first confirms that there are exactly three finite points and that the three `x` values are distinct. Distinct x-values are necessary because otherwise there is no unique quadratic interpolation.

> `buildVandermondeMatrix` turns the x-values into this coefficient matrix:

```text
[ 1  x0  x0^2 ]
[ 1  x1  x1^2 ]
[ 1  x2  x2^2 ]
```

> The y-values form the right-hand side vector. `fitQuadratic` then calls `solveLinearSystem` to find `[a0, a1, a2]`. These coefficients define the one quadratic that passes through all three sensor points.

> After solving, it calls `findPolynomialRoots` so the returned model includes the predicted landing position, as well as the matrix, coefficients, RREF result, and solver audit trail.

## 7. Kinematics and `generatePhysicsModel`

> The kinematics section builds a physically based trajectory before the linear-algebra reconstruction happens.

> `calculateFlightTime` uses the free-fall equation `t equals square root of 2h divided by g`. Given the release altitude and gravity, it determines how long the package takes to reach the ground.

> `calculateEffectiveHorizontalSpeed` combines aircraft speed and wind. Tailwind adds to the aircraft speed; headwind subtracts from it. `calculateKinematicPosition` expresses the physical motion as `x of t equals v effective times t` and `y of t equals h minus one half g t squared`.

> `generatePhysicsModel` is the usual automatic entry point. It validates the aircraft, altitude, gravity, and wind settings; calculates flight time and horizontal speed; then samples the physical path at 20%, 50%, and 80% of the descent.

> Those three samples are sent to `fitQuadratic`. This is intentional: the simulator generates a physical trajectory and then demonstrates that Gauss-Jordan elimination can reconstruct the same quadratic from measured points.

> If the wind exactly cancels horizontal velocity, the method changes the polynomial basis from horizontal distance to time. That avoids dividing by zero or creating three identical x-values for a vertical drop.

> The completed model includes the fitted coefficients, roots, sensor points, solver steps, flight duration, predicted landing coordinate, and metadata used by the animation.

## 8. Animation and trajectory sampling methods

> After a model is solved, `positionAtTime` calculates the package position during the animation. It clamps elapsed time to the valid flight duration, calculates horizontal position, and evaluates the polynomial to get altitude. At landing, it sets the altitude exactly to zero.

> `sampleTrajectory` evaluates the polynomial at many evenly spaced positions. The renderer uses that list of points to draw a smooth curve instead of just connecting three sensor readings.

> `trajectoryPosition` performs a similar calculation using normalized progress from zero to one. This makes it useful for progress-based animation controls.

## 9. Scene and viewport methods

> The mathematics also supports the visual layout. `measureSceneDomain` calculates the world-space bounds required to show the origin, landing point, sensors, aircraft travel, and — when relevant — the parabola vertex. It adds margins and guarantees a minimum visible span.

> `createSceneViewport` converts those world coordinates in metres into canvas pixels. The horizontal mapping is based on an x-scale. The vertical mapping subtracts altitude from the ground pixel coordinate because canvas y-values increase downward while altitude increases upward.

> These methods keep the graph and animation correctly framed even when the flight settings or screen size change.

## 10. Numerical and presentation helpers

> The final group contains smaller support methods. `positiveModulo` keeps repeating scenery coordinates within a positive range. `exponentialDecayBlend` smoothly moves the camera toward a new target rather than jumping instantly. `niceScaleTick` chooses readable scale marks such as 10, 20, or 50 metres.

> `validateFlightPath` checks whether a model is physically usable. It requires a forward landing root, a positive release altitude, and samples the curve to make sure it does not pass below ground before reaching its predicted landing point.

> `formatPolynomialText` turns the coefficient array into a readable equation for the interface, such as `y = 90 - 0.005x^2`.

## Closing

> In summary, `mathUtils.js` is a layered mathematical pipeline. It starts with either real simulation parameters or three sensor points. It builds and solves a Vandermonde linear system, converts the solution into a trajectory equation, finds the ground intercept, and then supports animation, validation, and drawing.

> The key educational feature is that every major result is traceable: the sensor points create the matrix, Gauss-Jordan elimination produces the coefficients, the coefficients define the parabola, and the parabola predicts the landing point.
