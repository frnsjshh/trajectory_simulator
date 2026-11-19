/**
 * ============================================================================
 * VECTOR / FLIGHT — LINEAR ALGEBRA SOLVER MODULE (solver.js)
 * ============================================================================
 *
 * This module provides the linear algebra solver for the Trajectory Simulator.
 * It implements Gauss–Jordan elimination with partial pivoting to solve the
 * linear system A · X = B for polynomial curve fitting.
 *
 * ARCHITECTURAL ROLE:
 * Delegates its core mathematical computations to the dedicated mathematical
 * engine in `mathUtils.js` while maintaining full backward compatibility with
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
    root.TrajectorySolver = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (mathUtils) {
  'use strict';

  /**
   * Solves a system of linear equations A · X = B using Gauss–Jordan elimination
   * with partial pivoting, producing Reduced Row Echelon Form (RREF) and an audit trail.
   *
   * - WHAT IT DOES:
   *     Solves the matrix equation A · X = B, transforming the augmented matrix [A | B]
   *     into Reduced Row Echelon Form [I | X], where I is the identity matrix and X is
   *     the solution vector containing the quadratic trajectory coefficients [a₀, a₁, a₂]ᵀ.
   *
   * - HOW IT WORKS:
   *     1. Creates augmented matrix [A | B] of size n × (n + 1).
   *     2. For each column k (0 to n - 1):
   *        a. Partial Pivoting: Selects row p ≥ k with largest absolute entry |A_{p, k}|.
   *        b. Swap: Exchanges Row k and Row p if p ≠ k (R_k ↔ R_p).
   *        c. Normalization: Divides Row k by pivot A_{k, k} (R_k ← (1 / A_{k, k}) R_k).
   *        d. Elimination: For all other rows i ≠ k, subtracts A_{i, k} · R_k (R_i ← R_i - A_{i, k} R_k).
   *     3. Cleans near-zero numerical residuals and extracts column n as vector X.
   *
   * - WHY IT IS USED:
   *     To reconstruct the supply crate's parabolic trajectory equation y(x) = a₀ + a₁x + a₂x²
   *     from 3 sensor measurement coordinates without assuming prior knowledge of aircraft speed
   *     or gravity. The step-by-step audit trail enables visual demonstration in the presentation mode.
   *
   * - VARIABLES:
   *     @param {number[][]} coefficients - Square n × n coefficient matrix A (e.g. Vandermonde matrix).
   *     @param {number[]} values - Right-hand side n-dimensional vector B (e.g. measured altitudes).
   *     @param {number} [tolerance=1e-12] - Minimum absolute value threshold for pivot selection.
   *
   * - RESULT:
   *     @returns {{ rref: number[][], solution: number[], steps: Array<{label: string, operation: string, matrix: number[][]}> }}
   *       - `rref`: Reduced row echelon form matrix [I | X].
   *       - `solution`: Vector X = [a₀, a₁, a₂]ᵀ.
   *       - `steps`: Step-by-step row operation history for interactive UI playback.
   *
   * - MATHEMATICAL FORMULA:
   *     [A | B] = [
   *       [ 1   x₀   x₀²  |  y₀ ]
   *       [ 1   x₁   x₁²  |  y₁ ]
   *       [ 1   x₂   x₂²  |  y₂ ]
   *     ] ⟶
   *     [I | X] = [
   *       [ 1   0    0   |  a₀ ]
   *       [ 0   1    0   |  a₁ ]
   *       [ 0   0    1   |  a₂ ]
   *     ]
   */
  function solveLinearSystem(coefficients, values, tolerance) {
    if (mathUtils && typeof mathUtils.solveLinearSystem === 'function') {
      return mathUtils.solveLinearSystem(coefficients, values, tolerance);
    }
    throw new Error('TrajectoryMathUtils module is required for linear system solving.');
  }

  return {
    solveLinearSystem
  };
});
