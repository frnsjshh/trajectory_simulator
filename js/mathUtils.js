/**
 * ============================================================================
 * VECTOR / FLIGHT — LINEAR ALGEBRA & MATHEMATICAL ENGINE (mathUtils.js)
 * ============================================================================
 *
 * Dedicated, pure mathematical module for the Trajectory Simulator project.
 * Contains ALL foundational mathematics, linear algebra, vector computations,
 * coordinate transformations, numerical methods, and kinematics calculations.
 *
 * ARCHITECTURAL DESIGN:
 * This file contains strictly pure mathematical and algorithmic logic:
 *   - NO DOM manipulation or UI elements
 *   - NO Canvas drawing or rendering calls
 *   - NO Event listeners or animation loops
 *   - NO External library dependencies
 *
 * It is structured into 9 logical sections for study, presentation, and defense:
 *   SECTION 1: Vector Operations & Linear Algebra Utilities
 *   SECTION 2: Matrix Creation, Manipulation & Elementary Row Operations
 *   SECTION 3: Gauss–Jordan Elimination with Partial Pivoting & Audit Trail
 *   SECTION 4: Polynomial Evaluation & Geometric Root Finding (Horner & Citardauq)
 *   SECTION 5: Polynomial Curve Fitting & Vandermonde Matrix Formulation
 *   SECTION 6: Kinematics & Projectile Motion Physics Formulas
 *   SECTION 7: Parametric Trajectory Sampling & Positioning
 *   SECTION 8: Coordinate Systems & 2D Affine Viewport Projections
 *   SECTION 9: Numerical & Geometric Utilities (Modulo, Smoothing, Scale Snapping)
 *
 * ============================================================================
 */

(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TrajectoryMathUtils = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Numerical precision threshold for zero-detection and floating-point comparisons
  const DEFAULT_TOLERANCE = 1e-12;

  // Standard acceleration due to gravity on Earth (m/s²)
  const STANDARD_GRAVITY = 9.81;

  // ==========================================================================
  // SECTION 1: VECTOR OPERATIONS & LINEAR ALGEBRA UTILITIES
  // ==========================================================================

  /**
   * Creates a vector (1D numerical array) of the specified size.
   *
   * - What it does: Allocates a 1D vector of length `size` filled with an initial value.
   * - How it works: Instantiates an array of length `size` and fills each element.
   * - Why it is used: Initializes coordinate vectors, coefficient vectors, and value arrays.
   * - Variables:
   *     @param {number} size - Number of dimensions / elements in the vector.
   *     @param {number} [fillValue=0] - Initial scalar value for every entry.
   * - Result:
   *     @returns {number[]} 1D array representing the vector v ∈ ℝⁿ.
   * - Mathematical formula:
   *     v = [fillValue, fillValue, ..., fillValue]ᵀ ∈ ℝⁿ
   */
  function createVector(size, fillValue = 0) {
    if (!Number.isInteger(size) || size < 0) {
      throw new Error('Vector size must be a non-negative integer.');
    }
    return new Array(size).fill(fillValue);
  }

  /**
   * Adds two vectors of equal dimension component-wise.
   *
   * - What it does: Computes the vector sum w = u + v.
   * - How it works: Iterates through elements: w[i] = u[i] + v[i].
   * - Why it is used: Combines displacement vectors or velocity vectors.
   * - Variables:
   *     @param {number[]} u - First vector u ∈ ℝⁿ.
   *     @param {number[]} v - Second vector v ∈ ℝⁿ.
   * - Result:
   *     @returns {number[]} Resulting sum vector w ∈ ℝⁿ.
   * - Mathematical formula:
   *     w = u + v = [u₁ + v₁, u₂ + v₂, ..., uₙ + vₙ]ᵀ
   */
  function vectorAdd(u, v) {
    if (!Array.isArray(u) || !Array.isArray(v) || u.length !== v.length) {
      throw new Error('Vectors must be arrays of equal length for addition.');
    }
    return u.map((val, idx) => val + v[idx]);
  }

  /**
   * Subtracts vector v from vector u component-wise.
   *
   * - What it does: Computes the vector difference w = u - v.
   * - How it works: Iterates through elements: w[i] = u[i] - v[i].
   * - Why it is used: Calculates relative displacement or error residuals between vectors.
   * - Variables:
   *     @param {number[]} u - Minuend vector u ∈ ℝⁿ.
   *     @param {number[]} v - Subtrahend vector v ∈ ℝⁿ.
   * - Result:
   *     @returns {number[]} Resulting difference vector w ∈ ℝⁿ.
   * - Mathematical formula:
   *     w = u - v = [u₁ - v₁, u₂ - v₂, ..., uₙ - vₙ]ᵀ
   */
  function vectorSubtract(u, v) {
    if (!Array.isArray(u) || !Array.isArray(v) || u.length !== v.length) {
      throw new Error('Vectors must be arrays of equal length for subtraction.');
    }
    return u.map((val, idx) => val - v[idx]);
  }

  /**
   * Multiplies a vector by a scalar constant.
   *
   * - What it does: Computes scalar multiplication w = c · v.
   * - How it works: Multiplies every element of vector v by the scalar c.
   * - Why it is used: Scales displacement by time, scales velocities, or normalizes vectors.
   * - Variables:
   *     @param {number[]} v - Input vector v ∈ ℝⁿ.
   *     @param {number} scalar - Scalar multiplier c ∈ ℝ.
   * - Result:
   *     @returns {number[]} Scaled vector w ∈ ℝⁿ.
   * - Mathematical formula:
   *     w = c · v = [c·v₁, c·v₂, ..., c·vₙ]ᵀ
   */
  function vectorScale(v, scalar) {
    if (!Array.isArray(v) || !Number.isFinite(scalar)) {
      throw new Error('Valid vector array and finite scalar are required.');
    }
    return v.map((val) => val * scalar);
  }

  /**
   * Computes the algebraic dot product (inner product) of two vectors.
   *
   * - What it does: Calculates the scalar inner product u · v.
   * - How it works: Sums the products of corresponding components: Σ (u[i] * v[i]).
   * - Why it is used: Evaluates row-vector multiplications, projections, and polynomial terms.
   * - Variables:
   *     @param {number[]} u - First vector u ∈ ℝⁿ.
   *     @param {number[]} v - Second vector v ∈ ℝⁿ.
   * - Result:
   *     @returns {number} Scalar dot product result.
   * - Mathematical formula:
   *     u · v = ⟨u, v⟩ = ∑_{i=1}^{n} (uᵢ · vᵢ)
   */
  function dotProduct(u, v) {
    if (!Array.isArray(u) || !Array.isArray(v) || u.length !== v.length) {
      throw new Error('Vectors must be arrays of equal length for dot product.');
    }
    return u.reduce((sum, val, idx) => sum + val * v[idx], 0);
  }

  /**
   * Calculates the Euclidean norm (geometric length / magnitude) of a vector.
   *
   * - What it does: Computes ||v||₂ = √(v · v).
   * - How it works: Computes square root of the sum of squared elements.
   * - Why it is used: Computes geometric distances, speeds from velocity components, and error bounds.
   * - Variables:
   *     @param {number[]} v - Input vector v ∈ ℝⁿ.
   * - Result:
   *     @returns {number} Non-negative scalar magnitude ||v||.
   * - Mathematical formula:
   *     ‖v‖₂ = √(∑_{i=1}^{n} vᵢ²)
   */
  function vectorNorm(v) {
    if (!Array.isArray(v)) throw new Error('Vector array is required.');
    return Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  }

  // ==========================================================================
  // SECTION 2: MATRIX CREATION, MANIPULATION & ELEMENTARY ROW OPERATIONS
  // ==========================================================================

  /**
   * Creates a 2D matrix of dimensions rows × cols.
   *
   * - What it does: Instantiates a 2D numerical array filled with an initial scalar.
   * - How it works: Creates an array of `rows` rows, each containing `cols` entries.
   * - Why it is used: Allocates coefficient matrices, augmented systems, and transformation matrices.
   * - Variables:
   *     @param {number} rows - Number of rows m.
   *     @param {number} cols - Number of columns n.
   *     @param {number} [fillValue=0] - Initial scalar value for every entry.
   * - Result:
   *     @returns {number[][]} 2D array representing matrix M ∈ ℝ^{m × n}.
   * - Mathematical formula:
   *     M = [M_{i,j}]_{m × n}, where M_{i,j} = fillValue
   */
  function createMatrix(rows, cols, fillValue = 0) {
    if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
      throw new Error('Matrix dimensions must be positive integers.');
    }
    return Array.from({ length: rows }, () => new Array(cols).fill(fillValue));
  }

  /**
   * Deep-clones a 2D numerical matrix.
   *
   * - What it does: Produces an independent copy of a 2D matrix.
   * - How it works: Maps each row to a newly sliced copy of that row array.
   * - Why it is used: Prevents mutation of input matrices and preserves state snapshots for presentation playback.
   * - Variables:
   *     @param {number[][]} matrix - Source matrix M.
   * - Result:
   *     @returns {number[][]} Cloned matrix M_copy.
   */
  function cloneMatrix(matrix) {
    if (!Array.isArray(matrix)) throw new Error('Matrix must be an array.');
    return matrix.map((row) => (Array.isArray(row) ? row.slice() : []));
  }

  /**
   * Constructs an augmented matrix [A | B] from coefficient matrix A and value vector B.
   *
   * - What it does: Concatenates the column vector B onto the right side of matrix A.
   * - How it works: Slices each row of A and appends the corresponding scalar B[i].
   * - Why it is used: Sets up the system for Gauss–Jordan elimination AX = B → [A | B].
   * - Variables:
   *     @param {number[][]} coefficients - Square coefficient matrix A ∈ ℝ^{n × n}.
   *     @param {number[]} values - Constant right-hand side vector B ∈ ℝⁿ.
   * - Result:
   *     @returns {number[][]} Augmented matrix [A | B] ∈ ℝ^{n × (n+1)}.
   * - Mathematical formula:
   *     [A | B] = [
   *       [ a₁₁  a₁₂  ...  a₁ₙ  |  b₁ ]
   *       [ a₂₁  a₂₂  ...  a₂ₙ  |  b₂ ]
   *       [ ...  ...  ...  ...  |  .. ]
   *       [ aₙ₁  aₙ₂  ...  aₙₙ  |  bₙ ]
   *     ]
   */
  function augmentMatrix(coefficients, values) {
    if (!Array.isArray(coefficients) || !Array.isArray(values)) {
      throw new Error('Coefficients matrix and values vector must be arrays.');
    }
    const size = coefficients.length;
    if (values.length !== size) {
      throw new Error('Coefficient matrix row count must match values vector length.');
    }
    return coefficients.map((row, index) => {
      if (!Array.isArray(row) || row.length !== size) {
        throw new Error('Coefficient matrix must be square.');
      }
      const augmentedRow = row.concat(values[index]);
      if (augmentedRow.some((val) => !Number.isFinite(val))) {
        throw new Error('All matrix values must be valid finite numbers.');
      }
      return augmentedRow;
    });
  }

  /**
   * Multiplies an m × n matrix A by an n-dimensional column vector v.
   *
   * - What it does: Computes matrix-vector product w = A · v.
   * - How it works: Takes the dot product of each row of A with vector v: w[i] = Σ_j A[i][j] * v[j].
   * - Why it is used: Verifies solved linear systems (A · X ≈ B) and applies coordinate transformation matrices.
   * - Variables:
   *     @param {number[][]} matrix - Matrix A ∈ ℝ^{m × n}.
   *     @param {number[]} vector - Column vector v ∈ ℝⁿ.
   * - Result:
   *     @returns {number[]} Resulting vector w ∈ ℝᵐ.
   * - Mathematical formula:
   *     wᵢ = ∑_{j=1}^{n} (A_{i,j} · vⱼ)
   */
  function matrixVectorMultiply(matrix, vector) {
    if (!Array.isArray(matrix) || !Array.isArray(vector)) {
      throw new Error('Matrix and vector must be arrays.');
    }
    const cols = vector.length;
    return matrix.map((row) => {
      if (!Array.isArray(row) || row.length !== cols) {
        throw new Error('Matrix column count must match vector length.');
      }
      return dotProduct(row, vector);
    });
  }

  /**
   * Elementary Row Operation I: Swaps row i and row j in place.
   *
   * - What it does: Performs R_i ↔ R_j.
   * - How it works: Exchanges the references of row arrays at index `rowA` and `rowB`.
   * - Why it is used: Implements partial pivoting to position the largest pivot on the diagonal.
   * - Variables:
   *     @param {number[][]} matrix - Target matrix M (modified in place).
   *     @param {number} rowA - First row index (0-based).
   *     @param {number} rowB - Second row index (0-based).
   * - Result:
   *     @returns {number[][]} The mutated matrix M.
   * - Mathematical formula:
   *     R_{rowA} ⟷ R_{rowB}
   */
  function swapRows(matrix, rowA, rowB) {
    if (rowA !== rowB) {
      const temp = matrix[rowA];
      matrix[rowA] = matrix[rowB];
      matrix[rowB] = temp;
    }
    return matrix;
  }

  /**
   * Elementary Row Operation II: Multiplies row i by a non-zero scalar.
   *
   * - What it does: Performs R_i ← (1 / scalar) · R_i or R_i ← scalar · R_i.
   * - How it works: Multiplies every element in `row` by `scalar` in place.
   * - Why it is used: Normalizes the leading pivot entry to 1 during Gauss–Jordan elimination.
   * - Variables:
   *     @param {number[][]} matrix - Target matrix M (modified in place).
   *     @param {number} row - Row index to scale (0-based).
   *     @param {number} scalar - Non-zero multiplier c ∈ ℝ.
   * - Result:
   *     @returns {number[][]} The mutated matrix M.
   * - Mathematical formula:
   *     R_{row} ⟵ c · R_{row}
   */
  function scaleRow(matrix, row, scalar) {
    const targetRow = matrix[row];
    for (let col = 0; col < targetRow.length; col += 1) {
      targetRow[col] *= scalar;
    }
    return matrix;
  }

  /**
   * Elementary Row Operation III: Adds a scalar multiple of sourceRow to targetRow.
   *
   * - What it does: Performs R_{target} ← R_{target} + scalar · R_{source}.
   * - How it works: For every column, target[col] += scalar * source[col].
   * - Why it is used: Eliminates off-diagonal entries in column k to reach reduced row echelon form (RREF).
   * - Variables:
   *     @param {number[][]} matrix - Target matrix M (modified in place).
   *     @param {number} targetRow - Row being modified.
   *     @param {number} sourceRow - Row being scaled and added.
   *     @param {number} scalar - Multiplier applied to source row.
   * - Result:
   *     @returns {number[][]} The mutated matrix M.
   * - Mathematical formula:
   *     R_{target} ⟵ R_{target} + c · R_{source}
   */
  function addScaledRow(matrix, targetRow, sourceRow, scalar) {
    const target = matrix[targetRow];
    const source = matrix[sourceRow];
    for (let col = 0; col < target.length; col += 1) {
      target[col] += scalar * source[col];
    }
    return matrix;
  }

  // ==========================================================================
  // SECTION 3: GAUSS–JORDAN ELIMINATION WITH PARTIAL PIVOTING & AUDIT TRAIL
  // ==========================================================================

  /**
   * Formats a floating point number for mathematical display and row operation logs.
   *
   * - What it does: Formats a number to 5 significant figures without trailing noise.
   * - How it works: Converts using `toPrecision(5)` and cleans up via `Number(...)`.
   * - Why it is used: Produces readable row operation descriptions for presentation steps.
   * - Variables:
   *     @param {number} value - Floating point value.
   * - Result:
   *     @returns {string} Clean string representation.
   */
  function formatNumber(value) {
    return Number(value.toPrecision(5)).toString();
  }

  /**
   * Solves a system of linear equations A · X = B using Gauss–Jordan elimination
   * with partial pivoting, recording an audit trail of every row operation.
   *
   * - What it does:
   *     Transforms the augmented matrix [A | B] into Reduced Row Echelon Form (RREF) [I | X],
   *     directly yielding the unique solution vector X = [a₀, a₁, ..., aₙ₋₁]ᵀ.
   *
   * - How it works (Algorithm):
   *     1. Augmentation: Constructs [A | B] of size n × (n+1).
   *     2. Column-by-column iteration (k = 0 to n-1):
   *        a. Partial Pivoting: Find row p ≥ k with maximum absolute value |A[p][k]|.
   *        b. Condition Check: If max pivot |A[p][k]| ≤ threshold, matrix is singular or ill-conditioned.
   *        c. Row Swap (R_k ↔ R_p): Moves pivot row to diagonal position k.
   *        d. Normalization: Scale row k by 1 / A[k][k] so the pivot entry becomes 1.
   *        e. Elimination: For every row i ≠ k, subtract A[i][k] · R_k from R_i to zero out column k.
   *     3. Residual Cleanup: Entries within 10× tolerance are zeroed to prevent floating-point -0.
   *     4. Extraction: The final column of RREF is the solution vector X.
   *
   * - Why it is used:
   *     This is the core mathematical engine of the project. It computes the polynomial coefficients
   *     [a₀, a₁, a₂] from sensor readings (x, y) without using external solvers or black-box libraries.
   *     Crucially, it captures each row operation snapshot so students and evaluators can inspect
   *     the linear algebra steps visually in real time.
   *
   * - Variables:
   *     @param {number[][]} coefficients - Square coefficient matrix A ∈ ℝ^{n × n}.
   *     @param {number[]} values - Constant right-hand side vector B ∈ ℝⁿ.
   *     @param {number} [tolerance=1e-12] - Pivot singularity threshold.
   *
   * - Result:
   *     @returns {{ rref: number[][], solution: number[], steps: Array<{label: string, operation: string, matrix: number[][]}> }}
   *       - `rref`: Matrix in Reduced Row Echelon Form [I | X].
   *       - `solution`: Solution vector X = [a₀, a₁, ..., aₙ₋₁]ᵀ.
   *       - `steps`: Array of recorded row operations for step-by-step presentation.
   *
   * - Mathematical formulas:
   *     System: A · X = B
   *     Augmented matrix: [A | B] ∈ ℝ^{n × (n+1)}
   *     Partial pivot selection: p = argmax_{i ≥ k} |A_{i,k}|
   *     Pivot normalization: R_k ⟵ (1 / A_{k,k}) · R_k
   *     Row elimination: R_i ⟵ R_i - A_{i,k} · R_k   (for all i ≠ k)
   *     Reduced Row Echelon Form: [A | B] ⟶ [I | X]
   */
  function solveLinearSystem(coefficients, values, tolerance = DEFAULT_TOLERANCE) {
    if (!Array.isArray(coefficients) || !Array.isArray(values) || coefficients.length === 0) {
      throw new Error('Provide a non-empty square coefficient matrix and a matching value vector.');
    }
    const size = coefficients.length;
    if (values.length !== size || coefficients.some((row) => !Array.isArray(row) || row.length !== size)) {
      throw new Error('The coefficient matrix must be square and match the value vector length.');
    }
    if (!Number.isFinite(tolerance) || tolerance <= 0) {
      throw new Error('Solver tolerance must be a positive finite number.');
    }

    // Step 1: Form the augmented matrix [A | B]
    const augmented = augmentMatrix(coefficients, values);

    // Initialize audit trail steps
    const steps = [{
      label: 'Starting augmented matrix',
      operation: 'Initial matrix',
      matrix: cloneMatrix(augmented)
    }];

    const record = (label, operation) => steps.push({
      label,
      operation,
      matrix: cloneMatrix(augmented)
    });

    const formatRow = (row) => `R${row + 1}`;

    // Step 2: Iterate over each column to achieve RREF
    for (let column = 0; column < size; column += 1) {
      // 2a: Find pivot row with largest magnitude (partial pivoting)
      let pivotRow = column;
      for (let candidate = column + 1; candidate < size; candidate += 1) {
        if (Math.abs(augmented[candidate][column]) > Math.abs(augmented[pivotRow][column])) {
          pivotRow = candidate;
        }
      }

      // 2b: Scale-dependent singularity threshold check
      const columnScale = Math.max(1, ...augmented.slice(column).map((row) => Math.abs(row[column])));
      const threshold = tolerance * columnScale;
      if (Math.abs(augmented[pivotRow][column]) <= threshold) {
        throw new Error(
          `The sensor matrix is singular or ill-conditioned near column ${column + 1}. ` +
          'Use three distinct x-values with a wider spread.'
        );
      }

      // 2c: Row swap R_column ↔ R_pivotRow if needed
      if (pivotRow !== column) {
        swapRows(augmented, column, pivotRow);
        record(
          `Swap ${formatRow(column)} ↔ ${formatRow(pivotRow)}`,
          `${formatRow(column)} ↔ ${formatRow(pivotRow)} (partial pivoting)`
        );
      }

      // 2d: Normalize pivot row: R_column ← R_column / pivot
      const pivot = augmented[column][column];
      if (Math.abs(pivot - 1) > threshold) {
        for (let entry = 0; entry <= size; entry += 1) {
          augmented[column][entry] /= pivot;
        }
        record(
          `Normalize ${formatRow(column)}`,
          `${formatRow(column)} → ${formatRow(column)} ÷ ${formatNumber(pivot)}`
        );
      }

      // 2e: Eliminate all other rows in this column: R_row ← R_row - factor · R_column
      for (let row = 0; row < size; row += 1) {
        if (row === column) continue;
        const factor = augmented[row][column];
        if (Math.abs(factor) <= threshold) {
          augmented[row][column] = 0;
          continue;
        }
        for (let entry = 0; entry <= size; entry += 1) {
          augmented[row][entry] -= factor * augmented[column][entry];
        }
        augmented[row][column] = 0;
        record(
          `Eliminate column ${column + 1} in ${formatRow(row)}`,
          `${formatRow(row)} → ${formatRow(row)} − (${formatNumber(factor)})${formatRow(column)}`
        );
      }
    }

    // Step 3: Clean up near-zero floating point residuals
    const clean = (val) => (Math.abs(val) <= tolerance * 10 ? 0 : val);
    const rref = augmented.map((row) => row.map(clean));

    if (rref.flat().some((val) => !Number.isFinite(val))) {
      throw new Error('The solver produced a non-finite result; check the scale of the sensor values.');
    }

    if (steps.length > 0) {
      steps[steps.length - 1].matrix = cloneMatrix(rref);
    }

    // Step 4: Extract the solution vector from the last column of RREF
    const solution = rref.map((row) => row[size]);

    return { rref, solution, steps };
  }

  // ==========================================================================
  // SECTION 4: POLYNOMIAL EVALUATION & GEOMETRIC ROOT FINDING
  // ==========================================================================

  /**
   * Evaluates a quadratic polynomial P(x) = a₀ + a₁x + a₂x² using Horner's method.
   *
   * - What it does: Computes the altitude y = P(x) at any horizontal position x.
   * - How it works: Expresses polynomial in nested form: a₀ + x · (a₁ + a₂ · x).
   * - Why it is used:
   *     Horner's method reduces polynomial evaluation from 3 multiplications and 2 additions
   *     to exactly 2 multiplications and 2 additions. It minimizes floating-point roundoff error.
   * - Variables:
   *     @param {number[]} coefficients - Polynomial coefficient vector [a₀, a₁, a₂].
   *     @param {number} x - Independent variable (horizontal distance in meters or elapsed time in seconds).
   * - Result:
   *     @returns {number} Evaluated altitude y = P(x).
   * - Mathematical formula:
   *     P(x) = a₀ + a₁ · x + a₂ · x² = a₀ + x · (a₁ + a₂ · x)
   */
  function evaluatePolynomial(coefficients, x) {
    const [a0, a1, a2] = coefficients;
    return a0 + x * (a1 + a2 * x);
  }

  // Backward compatibility alias for evaluatePolynomial
  const evaluate = evaluatePolynomial;

  /**
   * Computes the coordinates of the parabola vertex (peak or valley).
   *
   * - What it does: Finds the critical point where the slope dy/dx = 0.
   * - How it works:
   *     Differentiating y(x) = a₀ + a₁x + a₂x² yields y'(x) = a₁ + 2a₂x.
   *     Setting y'(x) = 0 gives x_v = -a₁ / (2a₂).
   *     Then y_v = P(x_v) = a₀ - a₁² / (4a₂).
   * - Why it is used:
   *     Ensures the adaptive camera bounds include the maximum trajectory peak
   *     even when the peak occurs between sensor readings or after release.
   * - Variables:
   *     @param {number[]} coefficients - Coefficient vector [a₀, a₁, a₂].
   * - Result:
   *     @returns {{ x: number, y: number } | null} Vertex coordinates, or null if linear/degenerate.
   * - Mathematical formula:
   *     x_v = -a₁ / (2 · a₂)
   *     y_v = a₀ + a₁ · x_v + a₂ · x_v² = a₀ - a₁² / (4 · a₂)
   */
  function calculateParabolaVertex(coefficients) {
    const [a0, a1, a2] = coefficients;
    if (!Number.isFinite(a2) || Math.abs(a2) < 1e-12) {
      return null; // Linear or constant: no parabolic vertex exists
    }
    const xVertex = -a1 / (2 * a2);
    const yVertex = a0 + xVertex * (a1 + a2 * xVertex);
    return { x: xVertex, y: yVertex };
  }

  /**
   * Finds the real roots (x-intercepts where y = 0) of the quadratic polynomial
   * using the numerically stable Citardauq (Muller's) formula.
   *
   * - What it does:
   *     Solves a₀ + a₁x + a₂x² = 0 for ground landing points where altitude y = 0.
   *     Identifies forward positive roots in the direction of flight.
   *
   * - How it works (Numerical Stability):
   *     Standard quadratic formula x = (-b ± √(b² - 4ac)) / (2a) suffers from catastrophic
   *     cancellation when 4ac ≪ b², because subtracting two nearly equal numbers loses precision.
   *     Instead, this implementation calculates:
   *       q = -0.5 · (a₁ + sgn(a₁) · √(a₁² - 4a₂a₀))
   *     and the two roots are:
   *       x₁ = q / a₂,   x₂ = a₀ / q
   *     This formulation eliminates subtraction of nearly identical numbers, guaranteeing
   *     full IEEE 754 precision for both roots regardless of scale differences.
   *
   * - Why it is used:
   *     Accurately predicts where the dropped supply crate will hit the ground (landing coordinate x).
   *     Also handles linear degenerate cases (a₂ = 0) when trajectory has no vertical curvature.
   *
   * - Variables:
   *     @param {number[]} coefficients - Polynomial coefficients [a₀, a₁, a₂].
   *     @param {number} [tolerance=1e-12] - Zero-detection threshold.
   *
   * - Result:
   *     @returns {{ roots: number[], positiveRoot: number|null, reason: string|null }}
   *       - `roots`: Sorted array of unique real root values.
   *       - `positiveRoot`: Smallest strictly positive real root (forward landing distance).
   *       - `reason`: Explanation if no valid forward landing root exists.
   *
   * - Mathematical formulas:
   *     Discriminant: Δ = a₁² - 4 · a₂ · a₀
   *     Citardauq root term: q = -½ · [ a₁ + sgn(a₁) · √Δ ]
   *     Roots: x₁ = q / a₂,   x₂ = a₀ / q
   */
  function findPolynomialRoots(coefficients, tolerance = DEFAULT_TOLERANCE) {
    const [a0, a1, a2] = coefficients;
    const scale = Math.max(1, Math.abs(a0), Math.abs(a1), Math.abs(a2));

    // Case 1: Degenerate linear equation (a₂ ≈ 0)
    if (Math.abs(a2) <= tolerance * scale) {
      if (Math.abs(a1) <= tolerance * scale) {
        return { roots: [], positiveRoot: null, reason: 'The altitude equation has no forward x-intercept.' };
      }
      const rootValue = -a0 / a1;
      return {
        roots: [rootValue],
        positiveRoot: rootValue > tolerance ? rootValue : null,
        reason: rootValue > tolerance ? null : 'The only x-intercept is not in the forward direction.'
      };
    }

    // Case 2: Quadratic equation (a₂ ≠ 0)
    let discriminant = a1 * a1 - 4 * a2 * a0;
    const discTolerance = tolerance * Math.max(1, a1 * a1, Math.abs(4 * a2 * a0));

    if (discriminant < -discTolerance) {
      return { roots: [], positiveRoot: null, reason: 'This polynomial has no real ground intersection.' };
    }
    if (discriminant < 0) {
      discriminant = 0; // Clamped for tangent / single-root touch
    }

    const squareRoot = Math.sqrt(discriminant);

    // Citardauq / Muller form avoids catastrophic cancellation:
    const q = -0.5 * (a1 + (a1 >= 0 ? squareRoot : -squareRoot));
    const roots = q === 0 ? [-a1 / (2 * a2)] : [q / a2, a0 / q];

    // Filter duplicates and sort in ascending order
    const uniqueRoots = roots
      .filter((val, idx) => Number.isFinite(val) && roots.findIndex((other) => Math.abs(other - val) <= tolerance * Math.max(1, Math.abs(val))) === idx)
      .sort((left, right) => left - right);

    const positiveRoot = uniqueRoots.find((val) => val > tolerance) ?? null;

    return {
      roots: uniqueRoots,
      positiveRoot,
      reason: positiveRoot === null ? 'No positive x-intercept is available for a forward landing.' : null
    };
  }

  // Backward compatibility alias for findPolynomialRoots
  const findPositiveRoot = findPolynomialRoots;

  // ==========================================================================
  // SECTION 5: POLYNOMIAL CURVE FITTING & VANDERMONDE MATRIX FORMULATION
  // ==========================================================================

  /**
   * Constructs the Vandermonde coefficient matrix for polynomial interpolation.
   *
   * - What it does:
   *     Builds the matrix A where row i is [1, xᵢ, xᵢ²] corresponding to the powers of xᵢ.
   * - How it works:
   *     Maps each point { x } to the row [1, x, x²].
   * - Why it is used:
   *     Expresses the polynomial evaluation equations P(xᵢ) = yᵢ in matrix form A · X = B.
   *     The determinant of a 3×3 Vandermonde matrix is det(A) = (x₁ - x₀)(x₂ - x₀)(x₂ - x₁).
   *     Hence, det(A) ≠ 0 if and only if all xᵢ are distinct!
   * - Variables:
   *     @param {Array<{x: number, y: number}>} points - Array of 3 coordinate points.
   * - Result:
   *     @returns {number[][]} 3×3 Vandermonde matrix A.
   * - Mathematical formula:
   *     A = [
   *       [ 1   x₀   x₀² ]
   *       [ 1   x₁   x₁² ]
   *       [ 1   x₂   x₂² ]
   *     ]
   */
  function buildVandermondeMatrix(points) {
    return points.map(({ x }) => [1, x, x * x]);
  }

  /**
   * Performs quadratic polynomial interpolation through exactly three sensor points.
   *
   * - What it does:
   *     Determines the unique quadratic polynomial y = a₀ + a₁x + a₂x² passing
   *     through three distinct data points (x₀, y₀), (x₁, y₁), (x₂, y₂).
   *
   * - How it works:
   *     1. Validates that points array contains exactly three finite, distinct points.
   *     2. Formulates the Vandermonde system A · X = B, where:
   *          A = [[1, x₀, x₀²], [1, x₁, x₁²], [1, x₂, x₂²]]
   *          B = [y₀, y₁, y₂]ᵀ
   *     3. Calls `solveLinearSystem(A, B)` to compute X = [a₀, a₁, a₂]ᵀ using Gauss–Jordan elimination.
   *     4. Computes ground landing roots via `findPolynomialRoots`.
   *
   * - Why it is used:
   *     Reconstructs the aircraft's supply drop flight path from sensor readings.
   *     This is the central linear algebra demonstration in the simulator.
   *
   * - Variables:
   *     @param {Array<{x: number, y: number}>} sensorPoints - Three measured coordinate points.
   *
   * - Result:
   *     @returns {{
   *       points: Array<{x: number, y: number}>,
   *       matrix: number[][],
   *       values: number[],
   *       coefficients: number[],
   *       roots: { roots: number[], positiveRoot: number|null, reason: string|null },
   *       rref: number[][],
   *       solution: number[],
   *       steps: Array<{label: string, operation: string, matrix: number[][]}>
   *     }}
   *
   * - Mathematical formula:
   *     [ 1  x₀  x₀² ] [ a₀ ]   [ y₀ ]
   *     [ 1  x₁  x₁² ] [ a₁ ] = [ y₁ ]
   *     [ 1  x₂  x₂² ] [ a₂ ]   [ y₂ ]
   */
  function fitQuadratic(sensorPoints) {
    if (!Array.isArray(sensorPoints) || sensorPoints.length !== 3) {
      throw new Error('Quadratic interpolation requires exactly three sensor points. Extra points are not silently ignored.');
    }

    const points = sensorPoints.map((point, index) => {
      const x = Number(point.x);
      const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Sensor ${index + 1} must contain finite numeric x and y values.`);
      }
      return { x, y };
    });

    // Check distinctness condition: det(A) ≠ 0 requires distinct x-values
    for (let left = 0; left < points.length; left += 1) {
      for (let right = left + 1; right < points.length; right += 1) {
        if (points[left].x === points[right].x) {
          throw new Error('Sensor x-values must be distinct for quadratic interpolation.');
        }
      }
    }

    const matrix = buildVandermondeMatrix(points);
    if (matrix.flat().some((val) => !Number.isFinite(val))) {
      throw new Error('Sensor distances are too large to construct a finite coefficient matrix.');
    }

    const values = points.map(({ y }) => y);
    const solved = solveLinearSystem(matrix, values);
    const coefficients = solved.solution;

    if (coefficients.some((val) => !Number.isFinite(val))) {
      throw new Error('The fitted coefficients are outside the numeric range.');
    }

    return {
      points,
      matrix,
      values,
      coefficients,
      roots: findPolynomialRoots(coefficients),
      ...solved
    };
  }

  // ==========================================================================
  // SECTION 6: KINEMATICS & PROJECTILE MOTION PHYSICS FORMULAS
  // ==========================================================================

  /**
   * Computes the theoretical flight duration until ground impact under gravity.
   *
   * - What it does: Solves free fall equation h - ½ g t² = 0 for duration t.
   * - How it works: t = √(2h / g).
   * - Why it is used: Determines total duration of falling crate animation and sensor timing.
   * - Variables:
   *     @param {number} altitude - Release height h > 0 in meters.
   *     @param {number} [gravity=9.81] - Gravitational acceleration g > 0 in m/s².
   * - Result:
   *     @returns {number} Flight time in seconds.
   * - Mathematical formula:
   *     t_{flight} = √(2 · h / g)
   */
  function calculateFlightTime(altitude, gravity = STANDARD_GRAVITY) {
    if (!Number.isFinite(altitude) || altitude <= 0) {
      throw new Error('Release altitude must be a positive finite number.');
    }
    if (!Number.isFinite(gravity) || gravity <= 0) {
      throw new Error('Gravity must be a positive finite number.');
    }
    return Math.sqrt((2 * altitude) / gravity);
  }

  /**
   * Calculates the signed effective horizontal velocity including aircraft speed and wind.
   *
   * - What it does: Computes net horizontal speed v_x = v_aircraft + v_wind.
   * - How it works:
   *     Tailwind acts in direction of flight (+v_wind).
   *     Headwind opposes flight (-v_wind).
   *     If wind is disabled, v_wind = 0.
   * - Why it is used: Combines independent velocity vectors into net horizontal travel speed.
   * - Variables:
   *     @param {number} aircraftSpeed - Plane forward speed in m/s.
   *     @param {number} windSpeed - Wind speed in m/s (0 to 20 m/s).
   *     @param {string} windDirection - 'tailwind' or 'headwind'.
   *     @param {boolean} windEnabled - Whether wind vector is active.
   * - Result:
   *     @returns {number} Signed effective speed in m/s.
   * - Mathematical formula:
   *     v_{eff} = v_{aircraft} + v_{wind,signed}
   *     where v_{wind,signed} = +v_w (tailwind) or -v_w (headwind)
   */
  function calculateEffectiveHorizontalSpeed(aircraftSpeed, windSpeed = 0, windDirection = 'tailwind', windEnabled = false) {
    if (!Number.isFinite(aircraftSpeed) || aircraftSpeed <= 0) {
      throw new Error('Aircraft speed must be a positive finite number.');
    }
    if (!Number.isFinite(windSpeed) || windSpeed < 0 || windSpeed > 20) {
      throw new Error('Wind speed must be between 0 and 20 m/s.');
    }
    const signedWind = windEnabled ? (windDirection === 'headwind' ? -windSpeed : windSpeed) : 0;
    return aircraftSpeed + signedWind;
  }

  /**
   * Evaluates the ideal kinematic projectile motion equations at time t.
   *
   * - What it does: Computes theoretical coordinates (x(t), y(t)) from Newtonian kinematics.
   * - How it works:
   *     Horizontal motion: x(t) = v_{eff} · t (uniform velocity)
   *     Vertical motion:   y(t) = h - ½ · g · t² (uniform acceleration under gravity)
   * - Why it is used:
   *     Generates sensor reading samples along the true physical trajectory.
   *     The simulator then demonstrates that Gauss–Jordan elimination on these samples
   *     faithfully recovers the physical trajectory coefficients:
   *       a₀ = h,   a₁ = 0,   a₂ = -g / (2 · v_{eff}²)
   * - Variables:
   *     @param {number} altitude - Release altitude h (m).
   *     @param {number} effectiveSpeed - Net horizontal velocity v_{eff} (m/s).
   *     @param {number} gravity - Acceleration due to gravity g (m/s²).
   *     @param {number} time - Elapsed time t since release (s).
   * - Result:
   *     @returns {{ x: number, y: number }} Physical position at time t.
   * - Mathematical formulas:
   *     x(t) = v_{eff} · t
   *     y(t) = h - ½ · g · t²
   */
  function calculateKinematicPosition(altitude, effectiveSpeed, gravity, time) {
    return {
      x: effectiveSpeed * time,
      y: altitude - 0.5 * gravity * time * time
    };
  }

  /**
   * Generates a complete physical simulation model from user parameters,
   * creates sensor readings, and fits the trajectory polynomial using Gauss–Jordan elimination.
   *
   * - What it does:
   *     Synthesizes parameters (aircraft speed, altitude, wind), samples three sensor points
   *     at fractional times [0.2 t_f, 0.5 t_f, 0.8 t_f], fits a quadratic curve via `fitQuadratic`,
   *     and computes the predicted landing location.
   *
   * - How it works:
   *     1. Calculates flight time t_f = √(2h / g) and effective horizontal velocity v_{eff}.
   *     2. If |v_{eff}| < 1e-10 (exact vertical drop due to headwind canceling plane speed),
   *        it selects time basis where x-axis is elapsed time t, preventing division by zero.
   *     3. Samples 3 points along the flight path.
   *     4. Reconstructs quadratic polynomial y = a₀ + a₁x + a₂x² via Gauss–Jordan elimination.
   *     5. Computes ground landing coordinate x_{landing} from the solved roots.
   *
   * - Why it is used:
   *     Links physical input controls to the linear algebra solver and animation systems.
   *
   * - Variables:
   *     @param {object} parameters - Configuration object:
   *       @param {number} [parameters.aircraftSpeed=60] - Aircraft speed (m/s).
   *       @param {number} [parameters.altitude=90] - Altitude (m).
   *       @param {number} [parameters.gravity=9.81] - Gravity (m/s²).
   *       @param {boolean} [parameters.windEnabled=false] - Wind toggle.
   *       @param {number} [parameters.windSpeed=0] - Wind velocity (m/s).
   *       @param {string} [parameters.windDirection='tailwind'] - Wind direction.
   *
   * - Result:
   *     @returns {object} Comprehensive physics model containing solved coefficients,
   *       landing prediction, sensor points, and elimination steps.
   */
  function generatePhysicsModel(parameters = {}) {
    const aircraftSpeed = Number(parameters.aircraftSpeed ?? parameters.speed ?? 60);
    const altitude = Number(parameters.altitude ?? 90);
    const gravity = Number(parameters.gravity ?? STANDARD_GRAVITY);
    const windEnabled = Boolean(parameters.windEnabled);
    const windSpeed = windEnabled ? Number(parameters.windSpeed ?? 0) : 0;
    const windDirection = parameters.windDirection === 'headwind' ? 'headwind' : 'tailwind';

    if (!Number.isFinite(aircraftSpeed) || aircraftSpeed <= 0) {
      throw new Error('Aircraft speed must be a positive finite number.');
    }
    if (!Number.isFinite(altitude) || altitude <= 0) {
      throw new Error('Release altitude must be a positive finite number.');
    }
    if (!Number.isFinite(gravity) || gravity <= 0) {
      throw new Error('Gravity must be a positive finite number.');
    }
    if (!Number.isFinite(windSpeed) || windSpeed < 0 || windSpeed > 20) {
      throw new Error('Wind speed must be between 0 and 20 m/s.');
    }

    const signedWindSpeed = windEnabled ? (windDirection === 'headwind' ? -windSpeed : windSpeed) : 0;
    const effectiveHorizontalSpeed = aircraftSpeed + signedWindSpeed;
    const flightTime = calculateFlightTime(altitude, gravity);
    const basis = Math.abs(effectiveHorizontalSpeed) < 1e-10 ? 'time' : 'distance';

    // Sample three distinct times during the descent: 20%, 50%, and 80% of total flight time
    const fractions = [0.2, 0.5, 0.8];
    const sampleTimes = fractions.map((fraction) => fraction * flightTime);

    const points = sampleTimes.map((time) => ({
      x: basis === 'time' ? time : effectiveHorizontalSpeed * time,
      y: altitude - 0.5 * gravity * time * time
    }));

    const solved = fitQuadratic(points);

    const landingTime = basis === 'time' ? solved.roots.positiveRoot : flightTime;
    const expectedLandingX = effectiveHorizontalSpeed * flightTime;

    const landingX = basis === 'time'
      ? 0
      : solved.roots.roots.find((val) => Math.sign(val) === Math.sign(expectedLandingX)) ?? null;

    if (landingTime === null || landingX === null) {
      throw new Error('The reconstructed polynomial has no landing root in the physical travel direction.');
    }

    return {
      ...solved,
      basis,
      axisLabel: basis === 'time' ? 'time (s)' : 'horizontal distance (m)',
      gravity,
      releaseAltitude: altitude,
      aircraftSpeed,
      windEnabled,
      windSpeed,
      windDirection,
      signedWindSpeed,
      effectiveHorizontalSpeed,
      flightTime,
      landingTime,
      landingX,
      landingDistance: Math.abs(landingX),
      scenePoints: points.map((point) => ({ x: basis === 'time' ? 0 : point.x, y: point.y }))
    };
  }

  // ==========================================================================
  // SECTION 7: PARAMETRIC TRAJECTORY SAMPLING & POSITIONING
  // ==========================================================================

  /**
   * Computes the falling crate position at elapsed time t using the solved polynomial.
   *
   * - What it does: Evaluates crate position (x, y) at time `elapsed` during flight.
   * - How it works:
   *     Clamps time t ∈ [0, flightTime].
   *     Computes horizontal position x = v_{eff} · t (or t if time-basis).
   *     Evaluates altitude y using the solved polynomial y = P(x).
   * - Why it is used: Drives the falling crate animation and HUD readouts.
   * - Variables:
   *     @param {object} model - Physics trajectory model.
   *     @param {number} elapsed - Elapsed flight time in seconds.
   * - Result:
   *     @returns {{ x: number, y: number, time: number, modelX: number }}
   */
  function positionAtTime(model, elapsed) {
    const flightTime = model.flightTime;
    const time = Math.min(flightTime, Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
    const atLanding = time >= flightTime;

    if (model.basis === 'time') {
      return {
        x: 0,
        y: atLanding ? 0 : evaluatePolynomial(model.coefficients, time),
        time,
        modelX: time
      };
    }

    const x = atLanding ? model.landingX : model.effectiveHorizontalSpeed * time;
    return {
      x,
      y: atLanding ? 0 : evaluatePolynomial(model.coefficients, x),
      time,
      modelX: x
    };
  }

  /**
   * Generates a discretized array of points along the trajectory curve for rendering.
   *
   * - What it does: Evaluates the polynomial at evenly spaced intervals from x = 0 to x = endX.
   * - How it works: Creates an array of `count` points where x_i = endX · (i / count), y_i = P(x_i).
   * - Why it is used: Draws the smooth parabolic path on canvas and graph plots.
   * - Variables:
   *     @param {number[]} coefficients - Polynomial coefficients [a₀, a₁, a₂].
   *     @param {number} endX - Terminal horizontal distance (landing point).
   *     @param {number} [count=80] - Number of segments for discretization.
   * - Result:
   *     @returns {Array<{x: number, y: number}>} Array of coordinates.
   */
  function sampleTrajectory(coefficients, endX, count = 80) {
    if (!Number.isFinite(endX) || endX < 0) return [];
    const safeCount = Math.max(2, Math.floor(count));
    return Array.from({ length: safeCount + 1 }, (_, index) => {
      const x = (endX * index) / safeCount;
      return { x, y: evaluatePolynomial(coefficients, x) };
    });
  }

  /**
   * Computes position along the trajectory by normalized progress fraction [0, 1].
   *
   * - What it does: Maps a fractional progress parameter to (x, y) coordinates.
   * - How it works: Clamps progress to [0, 1], multiplies by landing distance, and evaluates polynomial.
   * - Why it is used: Supports progress-based animation controllers.
   * - Variables:
   *     @param {object} model - Trajectory model.
   *     @param {number} progress - Progress value from 0.0 to 1.0.
   * - Result:
   *     @returns {{ x: number, y: number, progress: number }}
   */
  function trajectoryPosition(model, progress) {
    const clampedProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
    const landing = model.roots.positiveRoot;
    const x = landing === null ? 0 : landing * clampedProgress;
    return {
      x,
      y: clampedProgress === 1 && landing !== null ? 0 : evaluatePolynomial(model.coefficients, x),
      progress: clampedProgress
    };
  }

  // ==========================================================================
  // SECTION 8: COORDINATE SYSTEMS & 2D AFFINE VIEWPORT PROJECTIONS
  // ==========================================================================

  /**
   * Computes the bounding box of world coordinates that must be visible on screen.
   *
   * - What it does:
   *     Determines the minimum and maximum horizontal coordinates (domainMin, domainMax)
   *     and vertical coordinates (minAltitude, maxAltitude) required to display the aircraft,
   *     sensor points, flight lane, vertex peak, and landing location.
   *
   * - How it works:
   *     1. Gathers all critical scene x-values: origin (0), landing, plane travel, sensor xs.
   *     2. Computes the horizontal bounding span and adds proportional margins and cruise clearance.
   *     3. Enforces a minimum world domain (170 m) to prevent excessive zoom for short flights.
   *     4. Checks for parabolic vertex: if x_vertex is within scene span, includes y_vertex
   *        so high arches are not cropped.
   *
   * - Why it is used:
   *     Powers the adaptive camera that fits the entire flight into any canvas dimension.
   *
   * - Variables:
   *     @param {object} model - Active trajectory model.
   *     @param {object} [frame={}] - Current animation frame metadata.
   * - Result:
   *     @returns {{ domainMin: number, domainMax: number, releaseLaneSpan: number, worldDomain: number, minAltitude: number, maxAltitude: number, landingX: number|null }}
   */
  function measureSceneDomain(model, frame = {}) {
    const landingX = Number.isFinite(model?.landingX) ? model.landingX : model?.roots?.positiveRoot;
    const landing = Number.isFinite(landingX) ? landingX : 0;
    const sensorPoints = model?.scenePoints || model?.points || [];
    const sensorXs = sensorPoints.map(({ x }) => Number(x)).filter(Number.isFinite);
    const coefficients = model?.coefficients || [0, 0, 0];
    const aircraftSpeed = Math.max(Number(frame.parameters?.aircraftSpeed) || 0, Number(model?.aircraftSpeed) || 0);
    const flightTime = Math.max(0, Number(model?.flightTime) || 0);
    const planeTravel = aircraftSpeed * flightTime;

    const sceneXs = [0, landing, planeTravel, ...sensorXs];
    const minX = Math.min(...sceneXs);
    const maxX = Math.max(...sceneXs);
    const span = Math.max(0, maxX - minX);
    const margin = Math.max(16, span * 0.1);
    const cruise = Math.max(30, aircraftSpeed * 3);

    let domainMin = minX - margin;
    let domainMax = maxX + margin + cruise;
    const minimumSpan = 170;

    if (domainMax - domainMin < minimumSpan) {
      const pad = (minimumSpan - (domainMax - domainMin)) / 2;
      domainMin -= pad;
      domainMax += pad;
    }

    const releaseAltitude = Number(model?.releaseAltitude ?? coefficients[0]) || 0;
    const altitudeValues = [0, releaseAltitude, ...sensorPoints.map(({ y }) => Number(y)).filter(Number.isFinite)];

    // Check if the parabola vertex peak falls within horizontal domain
    const vertex = calculateParabolaVertex(coefficients);
    if (vertex && Number.isFinite(vertex.x) && vertex.x >= minX && vertex.x <= maxX) {
      altitudeValues.push(vertex.y);
    }

    const finiteAltitudes = altitudeValues.filter(Number.isFinite);
    return {
      domainMin,
      domainMax,
      releaseLaneSpan: cruise,
      worldDomain: domainMax - domainMin,
      minAltitude: Math.min(0, ...finiteAltitudes),
      maxAltitude: Math.max(10, ...finiteAltitudes),
      landingX: Number.isFinite(landingX) ? landingX : null
    };
  }

  /**
   * Computes the 2D affine transformation from World Space (meters) to Canvas Screen Space (pixels).
   *
   * - What it does:
   *     Calculates scale factors (xScale, yScale) and projection offsets that map:
   *       World coordinates (x_world in m, altitude in m)
   *       ⟶ Screen pixel coordinates (x_screen in px, y_screen in px).
   *
   * - How it works (Affine Transform):
   *     Horizontal mapping:
   *       x_screen = leftMargin + (x_world - domainMin) · xScale
   *     Vertical mapping (Canvas y points DOWNWARD, whereas altitude points UPWARD):
   *       y_screen = groundY - altitude · yScale
   *
   * - Why it is used:
   *     Ensures consistent, responsive mapping across arbitrary display resolutions,
   *     resizing, high-DPI displays, and fullscreen cockpit modes.
   *
   * - Variables:
   *     @param {number} width - Canvas viewport pixel width.
   *     @param {number} height - Canvas viewport pixel height.
   *     @param {object} model - Trajectory model.
   *     @param {object} [frame={}] - Frame state overrides and camera overrides.
   *
   * - Result:
   *     @returns {object} Viewport object with affine transform parameters and mapping functions:
   *       - `mapWorldX(worldX)`: Projects world x to screen x.
   *       - `mapSceneX(sceneX)`: Projects relative drop x to screen x.
   *       - `mapY(altitude)`: Projects altitude y to screen y.
   *
   * - Mathematical formulas:
   *     s_x = (right - left) / worldDomain
   *     s_y = (groundY - yTop) / (maxAltitude · 1.16)
   *     x_{screen} = left + x_{world} · s_x
   *     y_{screen} = groundY - altitude · s_y
   */
  function createSceneViewport(width, height, model, frame = {}) {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const measured = measureSceneDomain(model, frame);

    const domainMin = Number.isFinite(frame.domainOverride?.domainMin) ? frame.domainOverride.domainMin : measured.domainMin;
    const domainMax = Number.isFinite(frame.domainOverride?.domainMax) ? frame.domainOverride.domainMax : measured.domainMax;
    const maxAltitude = Number.isFinite(frame.domainOverride?.maxAltitude) ? frame.domainOverride.maxAltitude : measured.maxAltitude;
    const minAltitude = measured.minAltitude;
    const worldDomain = Math.max(1, domainMax - domainMin);

    const left = safeWidth * 0.07;
    const right = safeWidth * 0.93;
    const plotWidth = Math.max(1, right - left);
    const xScale = plotWidth / worldDomain;

    const yTop = safeHeight * 0.18;
    const groundY = safeHeight * 0.8;
    const yScale = (groundY - yTop) / (Math.max(10, maxAltitude) * 1.16);

    const phase = frame.state === 'PAUSED' ? frame.previousState : frame.state;
    const released = phase === 'FALLING' || phase === 'LANDED';
    const releaseDistance = Math.max(0, Number(frame.releasePlaneDistance) || 0);
    const releaseOffset = released ? releaseDistance : 0;
    const worldReleaseX = releaseOffset - domainMin;

    const mapWorldX = (worldX) => left + worldX * xScale;
    const mapSceneX = (sceneX) => mapWorldX(worldReleaseX + sceneX);
    const mapY = (altitude) => groundY - altitude * yScale;

    const planeWorldX = released
      ? worldReleaseX + Math.max(0, (Number(frame.planeDistance) || 0) - releaseDistance)
      : worldReleaseX;

    return {
      left,
      right,
      yTop,
      groundY,
      xScale,
      yScale,
      worldDomain,
      worldReleaseX,
      domainMin,
      domainMax,
      originX: mapSceneX(0),
      planeX: mapWorldX(planeWorldX),
      landingX: measured.landingX,
      maxAltitude,
      minAltitude,
      mapWorldX,
      mapSceneX,
      mapY
    };
  }

  // ==========================================================================
  // SECTION 9: NUMERICAL & GEOMETRIC UTILITIES
  // ==========================================================================

  /**
   * Euclidean (positive) modulo function.
   *
   * - What it does: Computes value mod divisor such that the result is strictly in [0, divisor).
   * - How it works: ((value % divisor) + divisor) % divisor.
   * - Why it is used:
   *     Standard JavaScript `%` operator is remainder, which returns negative values for negative inputs
   *     (e.g., -5 % 8 = -5). Euclidean modulo guarantees seamless, positive cyclic wrapping for
   *     parallax scrolling layers (mountains, trees, clouds, wind arrows).
   * - Variables:
   *     @param {number} value - Dividend.
   *     @param {number} divisor - Positive divisor.
   * - Result:
   *     @returns {number} Value in [0, divisor).
   * - Mathematical formula:
   *     mod(v, d) = ((v \pmod d) + d) \pmod d
   */
  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  /**
   * Exponential decay smoothing (asymptotic interpolation / low-pass filter).
   *
   * - What it does: Smoothly transitions a scalar from `current` toward `target`.
   * - How it works:
   *     Computes blend factor blend = 1 - e^(-rate · Δt).
   *     Updates value: current + (target - current) · blend.
   * - Why it is used:
   *     Smoothly adjusts camera viewport bounds when sliders change without sudden jumps.
   * - Variables:
   *     @param {number} current - Current value.
   *     @param {number} target - Target value.
   *     @param {number} rate - Decay rate constant k > 0.
   *     @param {number} deltaTime - Time delta Δt in seconds.
   * - Result:
   *     @returns {number} Interpolated value.
   * - Mathematical formula:
   *     v(t + Δt) = v(t) + (v_{target} - v(t)) · (1 - e^{-k · Δt})
   */
  function exponentialDecayBlend(current, target, rate, deltaTime) {
    if (deltaTime <= 0) return current;
    const blend = 1 - Math.exp(-rate * deltaTime);
    return current + (target - current) * blend;
  }

  /**
   * Discretizes a continuous distance into a "nice" human-readable scale tick (1, 2, or 5 × 10ⁿ).
   *
   * - What it does: Chooses a clean round number for the on-screen scale ruler.
   * - How it works:
   *     1. Computes decade magnitude 10^⌊log₁₀(d)⌋.
   *     2. Normalizes fraction = d / magnitude.
   *     3. Snaps fraction to 1, 2, or 5.
   * - Why it is used: Produces professional ruler increments (e.g. 10 m, 20 m, 50 m, 100 m).
   * - Variables:
   *     @param {number} rawDistance - Unrounded distance interval.
   * - Result:
   *     @returns {number} Snapped scale tick value.
   * - Mathematical formula:
   *     m = 10^{\lfloor \log_{10}(d) \rfloor}
   *     tick = m · (fraction ≥ 5 ? 5 : fraction ≥ 2 ? 2 : 1)
   */
  function niceScaleTick(rawDistance) {
    if (!Number.isFinite(rawDistance) || rawDistance <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(rawDistance));
    const fraction = rawDistance / magnitude;
    const preferred = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
    return preferred * magnitude;
  }

  /**
   * Validates whether a fitted polynomial describes a physically viable supply drop path.
   *
   * - What it does:
   *     Checks whether:
   *       1. A forward landing root exists.
   *       2. Release altitude a₀ > 0.
   *       3. The trajectory curve does NOT dip below ground (y < 0) before landing.
   * - How it works:
   *     Samples the polynomial at 30 intermediate intervals between x = 0 and x = x_{landing}.
   *     If any altitude y(x) < -1e-8, rejects the flight path as non-physical.
   * - Why it is used:
   *     Protects the flight simulator from non-physical manual sensor inputs.
   * - Variables:
   *     @param {object} model - Model to validate.
   *     @param {number} [sampleCount=30] - Number of test points.
   * - Result:
   *     @returns {{ valid: boolean, reason: string }}
   */
  function validateFlightPath(model, sampleCount = 30) {
    if (!model) return { valid: false, reason: 'No model provided.' };
    const rootX = Number.isFinite(model.landingX) ? model.landingX : model.roots?.positiveRoot;
    if (rootX === null || !Number.isFinite(rootX)) {
      return { valid: false, reason: model.roots?.reason || 'No forward landing point.' };
    }
    if (model.coefficients[0] <= 0) {
      return { valid: false, reason: 'Release altitude must be above ground level.' };
    }

    const duration = model.basis === 'time'
      ? (model.landingTime || model.flightTime)
      : rootX;

    for (let index = 1; index <= sampleCount; index += 1) {
      const progress = index / sampleCount;
      const x = duration * progress;
      const altitude = evaluatePolynomial(model.coefficients, x);
      if (altitude < -1e-8) {
        return { valid: false, reason: 'The fitted path crosses below ground before its predicted landing.' };
      }
    }
    return {
      valid: true,
      reason: model.basis === 'time' ? 'Vertical drop · time basis' : 'Flight path valid'
    };
  }

  /**
   * Formats polynomial coefficients into a mathematical display string: y = a₀ + a₁x + a₂x².
   *
   * - What it does: Constructs a human-readable algebraic equation string.
   * - How it works:
   *     Omits near-zero terms (< 1e-10) and properly formats plus/minus signs.
   * - Why it is used: Displays the reconstructed trajectory model on the UI dashboard.
   * - Variables:
   *     @param {number[]} coefficients - [a₀, a₁, a₂].
   *     @param {string} [variable='x'] - Variable symbol ('x' or 't').
   * - Result:
   *     @returns {string} Formatted equation string (e.g., "y = 90 − 0.0013625x²").
   */
  function formatPolynomialText(coefficients, variable = 'x') {
    const [a0, a1, a2] = coefficients;
    const formatEntry = (val) => {
      if (!Number.isFinite(val)) return '—';
      if (Math.abs(val) < 1e-10) return '0';
      const rounded = Number(val.toPrecision(5));
      return String(rounded).replace('-', '−');
    };

    const terms = [formatEntry(a0)];
    [[a1, variable], [a2, `${variable}²`]].forEach(([coeff, suffix]) => {
      if (Math.abs(coeff) < 1e-10) return;
      terms.push(`${coeff < 0 ? '−' : '+'} ${formatEntry(Math.abs(coeff))}${suffix}`);
    });
    return `y = ${terms.join(' ')}`;
  }

  // ==========================================================================
  // EXPORTED PUBLIC API
  // ==========================================================================

  return {
    // Constants
    DEFAULT_TOLERANCE,
    STANDARD_GRAVITY,

    // Section 1: Vectors
    createVector,
    vectorAdd,
    vectorSubtract,
    vectorScale,
    dotProduct,
    vectorNorm,

    // Section 2: Matrices
    createMatrix,
    cloneMatrix,
    augmentMatrix,
    matrixVectorMultiply,
    swapRows,
    scaleRow,
    addScaledRow,

    // Section 3: Linear Systems & Gauss-Jordan
    solveLinearSystem,
    formatNumber,

    // Section 4: Polynomials & Roots
    evaluatePolynomial,
    evaluate,
    calculateParabolaVertex,
    findPolynomialRoots,
    findPositiveRoot,

    // Section 5: Curve Fitting & Vandermonde
    buildVandermondeMatrix,
    fitQuadratic,

    // Section 6: Kinematics
    calculateFlightTime,
    calculateEffectiveHorizontalSpeed,
    calculateKinematicPosition,
    generatePhysicsModel,

    // Section 7: Sampling & Positioning
    positionAtTime,
    sampleTrajectory,
    trajectoryPosition,

    // Section 8: Viewport & Transforms
    measureSceneDomain,
    createSceneViewport,

    // Section 9: Utilities
    positiveModulo,
    exponentialDecayBlend,
    niceScaleTick,
    validateFlightPath,
    formatPolynomialText
  };
});
