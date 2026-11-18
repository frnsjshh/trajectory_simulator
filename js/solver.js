(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrajectorySolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_TOLERANCE = 1e-12;

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function solveLinearSystem(coefficients, values, tolerance = DEFAULT_TOLERANCE) {
    if (!Array.isArray(coefficients) || !Array.isArray(values) || coefficients.length === 0) {
      throw new Error('Provide a non-empty square coefficient matrix and a matching value vector.');
    }
    const size = coefficients.length;
    if (values.length !== size || coefficients.some((row) => !Array.isArray(row) || row.length !== size)) {
      throw new Error('The coefficient matrix must be square and match the value vector length.');
    }
    if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error('Solver tolerance must be a positive finite number.');

    const augmented = coefficients.map((row, index) => {
      const augmentedRow = row.concat(values[index]);
      if (augmentedRow.some((value) => !Number.isFinite(value))) {
        throw new Error('All matrix values must be valid finite numbers.');
      }
      return augmentedRow;
    });
    const steps = [{ label: 'Starting augmented matrix', operation: 'Initial matrix', matrix: cloneMatrix(augmented) }];

    const record = (label, operation) => steps.push({ label, operation, matrix: cloneMatrix(augmented) });
    const formatRow = (row) => `R${row + 1}`;

    for (let column = 0; column < size; column += 1) {
      let pivotRow = column;
      for (let candidate = column + 1; candidate < size; candidate += 1) {
        if (Math.abs(augmented[candidate][column]) > Math.abs(augmented[pivotRow][column])) pivotRow = candidate;
      }
      const columnScale = Math.max(1, ...augmented.slice(column).map((row) => Math.abs(row[column])));
      const threshold = tolerance * columnScale;
      if (Math.abs(augmented[pivotRow][column]) <= threshold) {
        throw new Error(`The sensor matrix is singular or ill-conditioned near column ${column + 1}. Use three distinct x-values with a wider spread.`);
      }

      if (pivotRow !== column) {
        [augmented[column], augmented[pivotRow]] = [augmented[pivotRow], augmented[column]];
        record(`Swap ${formatRow(column)} ↔ ${formatRow(pivotRow)}`, `${formatRow(column)} ↔ ${formatRow(pivotRow)} (partial pivoting)`);
      }

      const pivot = augmented[column][column];
      if (Math.abs(pivot - 1) > threshold) {
        for (let entry = 0; entry <= size; entry += 1) augmented[column][entry] /= pivot;
        record(`Normalize ${formatRow(column)}`, `${formatRow(column)} → ${formatRow(column)} ÷ ${formatNumber(pivot)}`);
      }

      for (let row = 0; row < size; row += 1) {
        if (row === column) continue;
        const factor = augmented[row][column];
        if (Math.abs(factor) <= threshold) {
          augmented[row][column] = 0;
          continue;
        }
        for (let entry = 0; entry <= size; entry += 1) augmented[row][entry] -= factor * augmented[column][entry];
        augmented[row][column] = 0;
        record(`Eliminate column ${column + 1} in ${formatRow(row)}`, `${formatRow(row)} → ${formatRow(row)} − (${formatNumber(factor)})${formatRow(column)}`);
      }
    }

    const clean = (value) => Math.abs(value) <= tolerance * 10 ? 0 : value;
    const rref = augmented.map((row) => row.map(clean));
    if (rref.flat().some((value) => !Number.isFinite(value))) throw new Error('The solver produced a non-finite result; check the scale of the sensor values.');
    if (steps.length) steps[steps.length - 1].matrix = cloneMatrix(rref);
    return { rref, solution: rref.map((row) => row[size]), steps };
  }

  function formatNumber(value) {
    return Number(value.toPrecision(5)).toString();
  }

  return { solveLinearSystem };
});