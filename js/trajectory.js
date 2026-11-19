/**
 * ============================================================================
 * VECTOR / FLIGHT — TRAJECTORY & KINEMATICS MODULE (trajectory.js)
 * ============================================================================
 *
 * This module coordinates the trajectory simulation, projectile physics,
 * quadratic polynomial fitting, and root-finding routines.
 *
 * ARCHITECTURAL ROLE:
 * Delegates its mathematical operations to the dedicated mathematical engine
 * in `mathUtils.js` while maintaining full backward compatibility with
 * existing tests and legacy script references.
 *
 * ============================================================================
 */

(function (root, factory) {
  'use strict';
  const mathUtils = typeof module === 'object' && module.exports
    ? require('./mathUtils.js')
    : root?.TrajectoryMathUtils;
  const api = factory(mathUtils);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TrajectoryMath = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (mathUtils) {
  'use strict';

  if (!mathUtils) {
    throw new Error('TrajectoryMathUtils module must be loaded before trajectory.js.');
  }

  /**
   * Evaluates a quadratic polynomial P(x) = a₀ + a₁x + a₂x² using Horner's method.
   *
   * - WHAT IT DOES:
   *     Computes the altitude y at any given horizontal distance x (or time t).
   *
   * - HOW IT WORKS:
   *     Uses nested multiplication: P(x) = a₀ + x · (a₁ + a₂ · x).
   *     Reduces floating point arithmetic operations from 3 multiplications to 2.
   *
   * - WHY IT IS USED:
   *     Provides fast, accurate altitude evaluation along the parabolic path.
   *
   * - VARIABLES:
   *     @param {number[]} coefficients - Polynomial coefficients [a₀, a₁, a₂].
   *     @param {number} x - Independent evaluation point (horizontal distance in meters or elapsed time in seconds).
   *
   * - RESULT:
   *     @returns {number} Evaluated altitude y.
   *
   * - MATHEMATICAL FORMULA:
   *     P(x) = a₀ + x(a₁ + a₂ x)
   */
  function evaluate(coefficients, x) {
    return mathUtils.evaluate(coefficients, x);
  }

  /**
   * Solves for real roots of the quadratic equation a₀ + a₁x + a₂x² = 0,
   * isolating the forward landing point using the numerically stable Citardauq formula.
   *
   * - WHAT IT DOES:
   *     Calculates the ground impact location where altitude y = 0.
   *
   * - HOW IT WORKS:
   *     Uses the Citardauq formulation:
   *       q = -½ · [ a₁ + sgn(a₁) · √(a₁² - 4a₂a₀) ]
   *       x₁ = q / a₂,   x₂ = a₀ / q
   *     This avoids catastrophic cancellation when 4a₂a₀ ≪ a₁².
   *
   * - WHY IT IS USED:
   *     Predicts exactly where the dropped crate will land without relying on idealized physics formulas.
   *
   * - VARIABLES:
   *     @param {number[]} coefficients - [a₀, a₁, a₂].
   *     @param {number} [tolerance=1e-12] - Zero-detection threshold.
   *
   * - RESULT:
   *     @returns {{ roots: number[], positiveRoot: number|null, reason: string|null }}
   *
   * - MATHEMATICAL FORMULA:
   *     Δ = a₁² - 4a₂a₀
   *     q = -½(a₁ + sgn(a₁)√Δ)
   *     roots = { q / a₂, a₀ / q }
   */
  function findPositiveRoot(coefficients, tolerance) {
    return mathUtils.findPositiveRoot(coefficients, tolerance);
  }

  /**
   * Fits a unique quadratic polynomial through exactly three distinct sensor points.
   *
   * - WHAT IT DOES:
   *     Constructs the 3×3 Vandermonde matrix and solves A · X = B for X = [a₀, a₁, a₂]ᵀ.
   *
   * - HOW IT WORKS:
   *     Validates 3 distinct x-coordinates, forms [A | B] where row i is [1, xᵢ, xᵢ² | yᵢ],
   *     and solves via Gauss–Jordan elimination with partial pivoting.
   *
   * - WHY IT IS USED:
   *     Serves as the central linear algebra concept: interpolating discrete sensor data
   *     into a continuous projectile trajectory.
   *
   * - VARIABLES:
   *     @param {Array<{x: number, y: number}>} sensorPoints - Three measured coordinate points.
   *
   * - RESULT:
   *     @returns {object} Fitted model with coefficients, matrix, rref, and roots.
   */
  function fitQuadratic(sensorPoints) {
    return mathUtils.fitQuadratic(sensorPoints);
  }

  /**
   * Generates a physical simulation model from flight parameters, creates 3 synthetic sensor
   * readings using kinematics, and reconstructs the polynomial via Gauss–Jordan elimination.
   *
   * - WHAT IT DOES:
   *     Simulates the flight: computes flight time t_f = √(2h / g), horizontal speed v_{eff} = v_{aircraft} + v_{wind},
   *     samples 3 sensor coordinates at t = [0.2, 0.5, 0.8] · t_f, and invokes `fitQuadratic`.
   *
   * - HOW IT WORKS:
   *     x(t) = (v_{aircraft} + v_{wind}) · t
   *     y(t) = h - ½ · g · t²
   *     Reconstructed polynomial: y(x) = h - [g / (2 · v_{eff}²)] · x²
   *
   * - WHY IT IS USED:
   *     Connects the physical flight controls (speed, altitude, wind) to the linear algebra solver.
   *
   * - VARIABLES:
   *     @param {object} [parameters={}] - Aircraft speed, altitude, gravity, wind speed/direction.
   *
   * - RESULT:
   *     @returns {object} Trajectory model with coefficients, landing point, and step history.
   */
  function generatePhysicsModel(parameters) {
    return mathUtils.generatePhysicsModel(parameters);
  }

  /**
   * Computes crate position (x, y) at elapsed time t using the solved polynomial.
   *
   * - WHAT IT DOES:
   *     Determines crate coordinates at time `elapsed` during descent.
   *
   * - VARIABLES:
   *     @param {object} model - Trajectory model.
   *     @param {number} elapsed - Seconds elapsed since release.
   *
   * - RESULT:
   *     @returns {{ x: number, y: number, time: number, modelX: number }}
   */
  function positionAtTime(model, elapsed) {
    return mathUtils.positionAtTime(model, elapsed);
  }

  /**
   * Discretizes the trajectory curve into an array of points for rendering.
   *
   * - VARIABLES:
   *     @param {number[]} coefficients - [a₀, a₁, a₂].
   *     @param {number} endX - Terminal horizontal distance.
   *     @param {number} [count=80] - Number of segments.
   *
   * - RESULT:
   *     @returns {Array<{x: number, y: number}>}
   */
  function sampleTrajectory(coefficients, endX, count) {
    return mathUtils.sampleTrajectory(coefficients, endX, count);
  }

  /**
   * Returns trajectory position at a normalized progress fraction [0, 1].
   *
   * - VARIABLES:
   *     @param {object} model - Trajectory model.
   *     @param {number} progress - Progress fraction from 0.0 to 1.0.
   *
   * - RESULT:
   *     @returns {{ x: number, y: number, progress: number }}
   */
  function trajectoryPosition(model, progress) {
    return mathUtils.trajectoryPosition(model, progress);
  }

  return {
    evaluate,
    findPositiveRoot,
    fitQuadratic,
    generatePhysicsModel,
    positionAtTime,
    sampleTrajectory,
    trajectoryPosition
  };
});
