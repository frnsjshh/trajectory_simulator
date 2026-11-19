(function (root, factory) {
  const math = typeof module === 'object' && module.exports ? require('./trajectory.js') : root.TrajectoryMath;
  const visualization = typeof module === 'object' && module.exports ? require('./visualization.js') : root.TrajectoryVisualization;
  const api = factory(math, visualization);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrajectoryApp = api;
  if (root?.document) api.init();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (math, visualization) {
  'use strict';

  const DEFAULT_POINTS = [{ x: 0, y: 45 }, { x: 1, y: 40 }, { x: 2, y: 25 }];
  const PRESENTATION = [
    { title: 'Aircraft parameters', text: 'Speed, altitude, gravity, and wind define the flight model.' },
    { title: 'Aircraft movement', text: 'Start the simulation. The aircraft advances at its selected speed while the landscape scrolls in the opposite direction.' },
    { title: 'Package release', text: 'Release the crate to begin its fall from the aircraft’s current position; the aircraft continues onward.' },
    { title: 'Sensor data generation', text: 'Three altitude samples are generated at different times along this flight, then expressed in distance or time coordinates.' },
    { title: 'Matrix construction', text: 'Each sample contributes [1, x, x²] to A, while its measured altitude contributes one value to B.' },
    { title: 'Gauss–Jordan elimination', text: 'The displayed row operations and matrices are the solver’s actual partial-pivoting steps.' },
    { title: 'Polynomial reconstruction', text: 'The solved vector X contains the coefficients of the quadratic reconstructed from the generated samples.' },
    { title: 'Trajectory visualization', text: 'The scene curve, sensor markers, and falling package share this fitted polynomial and one world-to-screen mapping.' },
    { title: 'Landing prediction', text: 'The solver-derived polynomial is evaluated at its ground intercept in the package’s direction of travel.' },
    { title: 'Final result', text: 'The package has reached the ground. Compare the observed landing position with the solver’s prediction.' }
  ];
  const PRESENTATION_STEP_SECONDS = 1.15;
  const PRESENTATION_MATRIX_INDEX = 5;

  function createPresentationState() {
    return { index: 0, playing: false, elapsed: 0 };
  }

  function presentationSimulationPhase(simulation) {
    return simulation?.status === 'PAUSED' ? simulation.previousState : simulation?.status;
  }

  function canEnterPresentationStep(index, model, simulation, matrixComplete = true) {
    if (!model) return false;
    const phase = presentationSimulationPhase(simulation);
    if (index === 0) return true;
    if (index === 1) return ['FLYING', 'FALLING', 'LANDED'].includes(phase);
    if (index === 2) return ['FALLING', 'LANDED'].includes(phase);
    if (index === 6 && !matrixComplete) return false;
    if (index >= 3 && index < PRESENTATION.length - 1) return ['FALLING', 'LANDED'].includes(phase);
    return index === PRESENTATION.length - 1 && phase === 'LANDED';
  }

  function transitionPresentation(current, action, simulation, model, matrixComplete = true) {
    const state = { ...current };
    if (action === 'restart') return createPresentationState();
    if (action === 'pause') return { ...state, playing: false };
    if (action === 'play') return state.index < PRESENTATION.length - 1 ? { ...state, playing: true } : state;
    if (simulation?.status === 'PAUSED') return state;
    if (action === 'previous' && state.index > 0) return { index: state.index - 1, playing: false, elapsed: 0 };
    if (action === 'next' && state.index < PRESENTATION.length - 1 && canEnterPresentationStep(state.index + 1, model, simulation, matrixComplete)) {
      return { index: state.index + 1, playing: false, elapsed: 0 };
    }
    return state;
  }

  function advancePresentation(current, deltaSeconds, simulation, model, playbackSpeed = 1, matrixComplete = true) {
    if (!current.playing || simulation?.status === 'PAUSED') return current;
    const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0) * Math.max(0, Number.isFinite(playbackSpeed) ? playbackSpeed : 1);
    const elapsed = Math.min(PRESENTATION_STEP_SECONDS, current.elapsed + delta);
    if (elapsed < PRESENTATION_STEP_SECONDS) return { ...current, elapsed };
    if (current.index >= PRESENTATION.length - 1) return { ...current, playing: false, elapsed: 0 };
    if (!canEnterPresentationStep(current.index + 1, model, simulation, matrixComplete)) return { ...current, elapsed: PRESENTATION_STEP_SECONDS };
    const nextIndex = current.index + 1;
    return { index: nextIndex, playing: nextIndex < PRESENTATION.length - 1, elapsed: 0 };
  }

  function createSimulationState() {
    return { status: 'READY', previousState: 'READY', progress: 0, planeProgress: 0, releasePlaneProgress: 0, planeDistance: 0, releasePlaneDistance: 0, flightElapsed: 0, time: 0, autoDropElapsed: 0, impactTime: 0 };
  }

  function transitionSimulation(current, action) {
    const state = { ...current };
    if (action === 'reset') return createSimulationState();
    if (action === 'start' && state.status === 'READY') {
      state.status = 'FLYING';
      state.previousState = 'FLYING';
      state.planeProgress = 0;
      state.planeDistance = 0;
      state.releasePlaneDistance = 0;
      state.autoDropElapsed = 0;
    } else if (action === 'drop' && state.status === 'FLYING') {
      state.status = 'FALLING';
      state.previousState = 'FALLING';
      state.releasePlaneProgress = state.planeProgress;
      state.releasePlaneDistance = state.planeDistance;
      state.progress = 0;
      state.flightElapsed = 0;
    } else if (action === 'land' && state.status === 'FALLING') {
      state.status = 'LANDED';
      state.previousState = 'LANDED';
      state.progress = 1;
      state.impactTime = state.time;
    } else if (action === 'pause' && ['FLYING', 'FALLING', 'LANDED'].includes(state.status)) {
      state.previousState = state.status;
      state.status = 'PAUSED';
    } else if (action === 'resume' && state.status === 'PAUSED') {
      state.status = state.previousState;
    } else if (action === 'replay') {
      const replay = createSimulationState();
      replay.status = 'FLYING';
      replay.previousState = 'FLYING';
      return replay;
    }
    return state;
  }

  function advanceSimulation(current, deltaSeconds, parameters, model, simulationSpeed = 1) {
    const state = { ...current };
    if (state.status === 'PAUSED') return state;
    const elapsed = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0) * Math.max(0, Number.isFinite(simulationSpeed) ? simulationSpeed : 1);
    if (elapsed === 0) return state;
    state.time += elapsed;
    if (state.status === 'FLYING' || state.status === 'FALLING' || state.status === 'LANDED') {
      const aircraftSpeed = Math.max(0, Number(parameters?.aircraftSpeed) || 0);
      state.planeDistance += aircraftSpeed * elapsed;
      state.planeProgress += elapsed;
    }
    if (state.status === 'FLYING') state.autoDropElapsed += elapsed;
    if (state.status === 'FALLING') {
      state.flightElapsed += elapsed;
      const duration = Math.max(Number.EPSILON, Number(model?.flightTime) || 0);
      state.progress = Math.min(1, state.flightElapsed / duration);
      if (state.progress >= 1) return transitionSimulation(state, 'land');
    }
    return state;
  }

  function init() {
    if (typeof document === 'undefined' || !document.getElementById('simulationCanvas')) return;
    const byId = (id) => document.getElementById(id);
    const elements = {
      sceneCanvas: byId('simulationCanvas'), graphCanvas: byId('trajectoryCanvas'), sceneWrap: byId('sceneWrap'), cockpit: byId('simulationCockpit'), fullscreenButton: byId('sceneFullscreen'), presentationPopup: byId('presentationPopup'),
      sceneStatus: byId('sceneStatus'), sceneAltitude: byId('sceneAltitude'), sceneScaleLabel: byId('sceneScaleLabel'), sceneScaleRule: byId('sceneScaleRule'),
      hudLanding: byId('hudLanding'), equation: byId('equationOutput'), equationNote: byId('equationNote'), landing: byId('landingOutput'), landingDirection: byId('landingDirection'),
      coefficientA0: byId('coefficientA0'), coefficientA1: byId('coefficientA1'), coefficientA2: byId('coefficientA2'),
      resultStatus: byId('resultStatus'), sensorCount: byId('sensorCount'), sensorCountBubble: byId('sensorCountBubble'),
      solverBadge: byId('solverBadge'), originalMatrix: byId('originalMatrix'), rrefMatrix: byId('rrefMatrix'), stepMatrix: byId('stepMatrix'),
      stepLabel: byId('stepLabel'), stepCounter: byId('stepCounter'), operationText: byId('operationText'), solutionVector: byId('solutionVector'),
      sensorRows: byId('sensorRows'), sensorError: byId('sensorError'), sensorModeDescription: byId('sensorModeDescription'), sensorXAxisUnit: byId('sensorXAxisUnit'), graphTooltip: byId('graphTooltip'),
      startButton: byId('startButton'), dropButton: byId('dropButton'), pauseButton: byId('pauseButton'), resumeButton: byId('resumeButton'),
      resetButton: byId('resetButton'), replayButton: byId('replayButton'), speedSlider: byId('speedSlider'), speedValue: byId('speedValue'),
      aircraftSpeedSlider: byId('aircraftSpeedSlider'), aircraftSpeedValue: byId('aircraftSpeedValue'), altitudeSlider: byId('altitudeSlider'), altitudeValue: byId('altitudeValue'),
      windToggle: byId('windToggle'), windSpeedSlider: byId('windSpeedSlider'), windSpeedValue: byId('windSpeedValue'), windDirection: byId('windDirection'), parameterNotice: byId('parameterNotice'),
      trajectoryToggle: byId('trajectoryToggle'), graphToggle: byId('graphToggle'), matrixToggle: byId('matrixToggle'), sensorToggle: byId('sensorToggle'), sensorLabelsToggle: byId('sensorLabelsToggle'), landingToggle: byId('landingToggle'), windVisualToggle: byId('windVisualToggle'), resultsToggle: byId('resultsToggle'), autoDropToggle: byId('autoDropToggle'), manualModeToggle: byId('manualModeToggle'),
      presentationToggle: byId('presentationToggle'), presentationOpen: byId('presentationOpen'), presentationClose: byId('presentationClose'), presentationStep: byId('presentationStep'), presentationTitle: byId('presentationTitle'), presentationText: byId('presentationText'), presentationContext: byId('presentationContext'), presentationWait: byId('presentationWait'), presentationProgress: byId('presentationProgress'), presentationPrevious: byId('presentationPrevious'), presentationNext: byId('presentationNext'), presentationPlay: byId('presentationPlay'), presentationPause: byId('presentationPause'), presentationRestart: byId('presentationRestart'),
      planeUpload: byId('planeUpload'), packageUpload: byId('packageUpload'),
      planePreview: byId('planePreview'), packagePreview: byId('packagePreview'), planePreviewLabel: byId('planePreviewLabel'),
      packagePreviewLabel: byId('packagePreviewLabel'), artworkMessage: byId('artworkMessage')
    };
    let sensorPoints = DEFAULT_POINTS.map((point) => ({ ...point }));
    let model = null;
    let flightValid = false;
    let flightReason = '';
    let simulation = createSimulationState();
    let stepIndex = 0;
    let stepPlaybackActive = false;
    let stepPlaybackElapsed = 0;
    let animationHandle = null;
    let previousFrameTime = null;
    let graphViewport = null;
    let planeImage = null;
    let packageImage = null;
    let planeObjectUrl = null;
    let packageObjectUrl = null;
    let presentation = createPresentationState();
    let presentationOpen = false;
    let lastPresentationNavigation = -Infinity;
    let flightParameters = null;
    let camera = null;

    function parametersForFlight() {
      if (simulation.status === 'READY' || !flightParameters) return readParameters(elements);
      return flightParameters;
    }

    function updateCamera(activeModel, parameters, delta) {
      const target = visualization.measureSceneDomain(activeModel, { parameters });
      if (!camera) camera = { domainMin: target.domainMin, domainMax: target.domainMax, maxAltitude: target.maxAltitude };
      if (simulation.status === 'READY' && delta > 0) {
        const blend = 1 - Math.exp(-6 * delta);
        camera.domainMin += (target.domainMin - camera.domainMin) * blend;
        camera.domainMax += (target.domainMax - camera.domainMax) * blend;
        camera.maxAltitude += (target.maxAltitude - camera.maxAltitude) * blend;
      }
      return camera;
    }

    function formatNumber(value, digits = 5) {
      if (!Number.isFinite(value)) return '—';
      if (Math.abs(value) < 1e-10) return '0';
      const rounded = Number(value.toPrecision(digits));
      return String(rounded).replace('-', '−');
    }

    function formatFixed(value, digits = 2) {
      return Number.isFinite(value) ? value.toFixed(digits) : '—';
    }

    function niceScaleTick(rawDistance) {
      if (!Number.isFinite(rawDistance) || rawDistance <= 0) return 1;
      const magnitude = 10 ** Math.floor(Math.log10(rawDistance));
      const fraction = rawDistance / magnitude;
      const preferred = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
      return preferred * magnitude;
    }

    function polynomialText(coefficients, variable = 'x') {
      const [a0, a1, a2] = coefficients;
      const terms = [formatNumber(a0)];
      [[a1, variable], [a2, `${variable}²`]].forEach(([coefficient, suffix]) => {
        if (Math.abs(coefficient) < 1e-10) return;
        terms.push(`${coefficient < 0 ? '−' : '+'} ${formatNumber(Math.abs(coefficient))}${suffix}`);
      });
      return `y = ${terms.join(' ')}`;
    }

    function readParameters(elements) {
      return {
        aircraftSpeed: Number(elements.aircraftSpeedSlider.value),
        altitude: Number(elements.altitudeSlider.value),
        windEnabled: elements.windToggle.checked,
        windSpeed: Number(elements.windSpeedSlider.value),
        windDirection: elements.windDirection.value,
        gravity: 9.81
      };
    }

    function updateParameterReadouts(elements) {
      elements.aircraftSpeedValue.value = `${Number(elements.aircraftSpeedSlider.value).toFixed(0)} m/s`;
      elements.altitudeValue.value = `${Number(elements.altitudeSlider.value).toFixed(0)} m`;
      elements.windSpeedValue.value = elements.windToggle.checked
        ? `${Number(elements.windSpeedSlider.value).toFixed(1)} m/s`
        : '0 m/s · OFF';
      elements.windSpeedSlider.disabled = !elements.windToggle.checked;
      elements.windDirection.disabled = !elements.windToggle.checked;
    }

    function clearError() {
      elements.sensorError.hidden = true;
      elements.sensorError.textContent = '';
    }

    function showError(message) {
      elements.sensorError.textContent = message;
      elements.sensorError.hidden = false;
    }

    function readSensorRows() {
      return Array.from(elements.sensorRows.querySelectorAll('tr')).map((row) => {
        const xText = row.querySelector('[data-axis="x"]').value.trim();
        const yText = row.querySelector('[data-axis="y"]').value.trim();
        return { x: xText === '' ? NaN : Number(xText), y: yText === '' ? NaN : Number(yText) };
      });
    }

    function renderSensorRows(points, editable = elements.manualModeToggle.checked) {
      elements.sensorRows.replaceChildren();
      points.forEach((point, index) => {
        const row = document.createElement('tr');
        const number = document.createElement('td');
        number.className = 'sensor-index';
        number.textContent = String(index + 1).padStart(2, '0');
        const xCell = document.createElement('td');
        const xInput = document.createElement('input');
        xInput.className = 'sensor-input';
        xInput.type = 'number';
        xInput.step = 'any';
        xInput.inputMode = 'decimal';
        xInput.dataset.axis = 'x';
        xInput.readOnly = !editable;
        xInput.setAttribute('aria-label', `Sensor ${index + 1} horizontal distance x`);
        xInput.value = Number.isFinite(point.x) ? String(point.x) : '';
        xCell.append(xInput);
        const yCell = document.createElement('td');
        const yInput = document.createElement('input');
        yInput.className = 'sensor-input';
        yInput.type = 'number';
        yInput.step = 'any';
        yInput.inputMode = 'decimal';
        yInput.dataset.axis = 'y';
        yInput.readOnly = !editable;
        yInput.setAttribute('aria-label', `Sensor ${index + 1} altitude y`);
        yInput.value = Number.isFinite(point.y) ? String(point.y) : '';
        yCell.append(yInput);
        const removeCell = document.createElement('td');
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-sensor';
        removeButton.type = 'button';
        removeButton.dataset.removeIndex = String(index);
        removeButton.hidden = !editable;
        removeButton.setAttribute('aria-label', `Remove sensor ${index + 1}`);
        removeButton.textContent = '×';
        removeCell.append(removeButton);
        row.append(number, xCell, yCell, removeCell);
        elements.sensorRows.append(row);
      });
      elements.sensorCount.textContent = String(points.length);
      elements.sensorCountBubble.textContent = String(points.length).padStart(2, '0');
    }

    function renderMatrix(container, matrix) {
      container.replaceChildren();
      if (!matrix) return;
      matrix.forEach((row) => {
        const matrixRow = document.createElement('div');
        matrixRow.className = 'matrix-row';
        row.forEach((value) => {
          const cell = document.createElement('span');
          cell.textContent = formatNumber(value, 4);
          matrixRow.append(cell);
        });
        container.append(matrixRow);
      });
    }

    function renderSolutionVector(coefficients) {
      elements.solutionVector.replaceChildren();
      coefficients.forEach((coefficient, index) => {
        if (index > 0) {
          const separator = document.createElement('i');
          separator.textContent = '·';
          elements.solutionVector.append(separator);
        }
        const value = document.createElement('span');
        value.textContent = formatNumber(coefficient);
        elements.solutionVector.append(value);
      });
    }

    function makeFlightVerdict(nextModel) {
      const rootX = Number.isFinite(nextModel.landingX) ? nextModel.landingX : nextModel.roots.positiveRoot;
      if (rootX === null || !Number.isFinite(rootX)) return { valid: false, reason: nextModel.roots.reason || 'No forward landing point.' };
      if (nextModel.coefficients[0] <= 0) return { valid: false, reason: 'Release altitude must be above ground level.' };
      for (let index = 1; index <= 30; index += 1) {
        const progress = index / 30;
        const x = nextModel.basis === 'time'
          ? (nextModel.landingTime || nextModel.flightTime) * progress
          : rootX * progress;
        const altitude = math.evaluate(nextModel.coefficients, x);
        if (altitude < -1e-8) return { valid: false, reason: 'The fitted path crosses below ground before its predicted landing.' };
      }
      return { valid: true, reason: nextModel.basis === 'time' ? 'Vertical drop · time basis' : 'Flight path valid' };
    }

    function stopStepPlayback(resetElapsed = true) {
      stepPlaybackActive = false;
      if (resetElapsed) stepPlaybackElapsed = 0;
      byId('playStepsIcon').textContent = '▶';
      byId('playStepsText').textContent = 'Play steps';
    }

    function presentationMatrixComplete() {
      return !model || model.steps.length <= 1 || (!stepPlaybackActive && stepIndex >= model.steps.length - 1);
    }

    function startStepPlayback(resetElapsed = true) {
      if (!model || stepIndex >= model.steps.length - 1) return;
      stepPlaybackActive = true;
      if (resetElapsed) stepPlaybackElapsed = 0;
      byId('playStepsIcon').textContent = 'Ⅱ';
      byId('playStepsText').textContent = 'Pause steps';
    }

    function startPresentationMatrix() {
      stopStepPlayback();
      stepIndex = 0;
      renderStep();
      startStepPlayback();
    }

    function applyPresentationAction(action) {
      const previousIndex = presentation.index;
      presentation = transitionPresentation(presentation, action, simulation, model, presentationMatrixComplete());
      if (action === 'restart') {
        stopStepPlayback();
        stepIndex = 0;
        renderStep();
      } else if (action === 'pause' && previousIndex === PRESENTATION_MATRIX_INDEX) {
        stopStepPlayback(false);
      } else if (action === 'previous' && previousIndex === PRESENTATION_MATRIX_INDEX && presentation.index !== PRESENTATION_MATRIX_INDEX) {
        stopStepPlayback();
      }
      if (presentation.index === PRESENTATION_MATRIX_INDEX && previousIndex !== PRESENTATION_MATRIX_INDEX) {
        startPresentationMatrix();
      } else if (action === 'play' && presentation.index === PRESENTATION_MATRIX_INDEX && !presentationMatrixComplete()) {
        startStepPlayback(false);
      }
      renderPresentation();
    }

    function navigatePresentation(action) {
      const now = window.performance.now();
      if (now - lastPresentationNavigation < 240) return;
      lastPresentationNavigation = now;
      applyPresentationAction(action);
    }

    function renderStep() {
      if (!model || !model.steps.length) return;
      stepIndex = Math.max(0, Math.min(model.steps.length - 1, stepIndex));
      const step = model.steps[stepIndex];
      elements.stepLabel.textContent = `Step ${stepIndex + 1} of ${model.steps.length} · ${step.label}`;
      elements.stepCounter.textContent = `${String(stepIndex + 1).padStart(2, '0')} / ${String(model.steps.length).padStart(2, '0')}`;
      elements.operationText.textContent = step.operation;
      renderMatrix(elements.stepMatrix, step.matrix);
      byId('stepBack').disabled = stepIndex === 0;
      byId('stepForward').disabled = stepIndex === model.steps.length - 1;
    }

    function setPresentationOpen(open) {
      presentationOpen = Boolean(open);
      if (!presentationOpen) applyPresentationAction('pause');
      elements.presentationPopup.hidden = !presentationOpen;
      elements.presentationToggle.checked = presentationOpen;
      renderPresentation();
      if (presentationOpen) elements.presentationClose.focus();
      else elements.presentationOpen.focus();
    }

    function presentationContext(index) {
      if (!model) return 'Correct the sensor data to restore the computed model.';
      const parameters = parametersForFlight();
      const wind = parameters.windEnabled ? `${parameters.windSpeed} m/s ${parameters.windDirection}` : 'off';
      if (index === 0) return model.isManual
        ? `Manual interpolation · fitted release altitude ${formatFixed(model.releaseAltitude, 1)} m. Flight controls do not generate these readings.`
        : `Aircraft ${formatFixed(parameters.aircraftSpeed, 1)} m/s · release altitude ${formatFixed(model.releaseAltitude, 1)} m · wind ${wind}.`;
      if (index === 1) return `Aircraft speed: ${formatFixed(parameters.aircraftSpeed, 1)} m/s. Scene status: ${simulation.status.toLowerCase()}.`;
      if (index === 2) return `Release coordinate: ${formatFixed(simulation.releasePlaneDistance, 1)} m along the aircraft’s flight; fitted drop duration ${formatFixed(model.flightTime, 2)} s.`;
      if (index === 3) return model.points.map((point, pointIndex) => `S${pointIndex + 1} (${formatFixed(point.x, 3)}, ${formatFixed(point.y, 3)})`).join(' · ');
      if (index === 4) return model.matrix.map((row, rowIndex) => `[${row.map((value) => formatFixed(value, 3)).join(', ')} | ${formatFixed(model.values[rowIndex], 3)}]`).join('\n');
      if (index === PRESENTATION_MATRIX_INDEX) {
        const step = model.steps[Math.min(stepIndex, model.steps.length - 1)];
        return `${stepIndex + 1} of ${model.steps.length} · ${step.operation}`;
      }
      if (index === 6) return polynomialText(model.coefficients, model.basis === 'time' ? 't' : 'x');
      if (index === 7) return `The curve is reconstructed from [${model.coefficients.map((value) => formatFixed(value, 5)).join(', ')}] and ends at the fitted ground intercept.`;
      if (index === 8) return `Predicted displacement: ${formatFixed(model.landingX, 2)} m (${model.landingX < 0 ? 'left' : model.landingX > 0 ? 'right' : 'directly below'} of release).`;
      const observed = math.positionAtTime(model, simulation.flightElapsed).x;
      return `Predicted ${formatFixed(model.landingX, 2)} m · observed ${formatFixed(observed, 2)} m from release.`;
    }

    function presentationWaitText() {
      const next = presentation.index + 1;
      if (next === 1 && !canEnterPresentationStep(next, model, simulation)) return 'Waiting for Start Simulation; the flight has not begun yet.';
      if (next === 2 && !canEnterPresentationStep(next, model, simulation)) return 'Waiting for the aircraft to release the package.';
      if (next === PRESENTATION_MATRIX_INDEX + 1 && !presentationMatrixComplete()) return 'Waiting for the actual Gauss–Jordan row-operation playback to finish.';
      if (next === PRESENTATION.length - 1 && !canEnterPresentationStep(next, model, simulation)) return 'Waiting for the package to complete its descent and land.';
      if (presentation.index === PRESENTATION.length - 1) return 'Presentation complete.';
      return 'Use Next to continue one step, or Play to advance automatically when each event is ready.';
    }

    function renderPresentation() {
      const current = PRESENTATION[presentation.index];
      elements.presentationStep.textContent = `Step ${presentation.index + 1} of ${PRESENTATION.length}`;
      elements.presentationTitle.textContent = current.title;
      elements.presentationText.textContent = current.text;
      if (model?.isManual && presentation.index === 3) elements.presentationText.textContent = 'These are the three editable measurements used for this interpolation demonstration, not physics-generated sensor readings.';
      elements.presentationContext.textContent = presentationContext(presentation.index);
      elements.presentationWait.textContent = presentationWaitText();
      elements.presentationProgress.style.width = `${((presentation.index + 1) / PRESENTATION.length) * 100}%`;
      elements.presentationNext.title = presentationWaitText();
      const simulationPaused = simulation.status === 'PAUSED';
      elements.presentationPrevious.disabled = presentation.index === 0 || simulationPaused;
      elements.presentationNext.disabled = presentation.index >= PRESENTATION.length - 1 || simulationPaused || !canEnterPresentationStep(presentation.index + 1, model, simulation, presentationMatrixComplete());
      elements.presentationPlay.hidden = presentation.playing;
      elements.presentationPause.hidden = !presentation.playing;
      elements.presentationPlay.disabled = !model || simulationPaused || presentation.index >= PRESENTATION.length - 1;
      elements.presentationPause.disabled = !presentation.playing;
      elements.presentationRestart.disabled = !model;
    }

    function renderModel() {
      const manualMode = elements.manualModeToggle.checked;
      const parameters = readParameters(elements);
      const generatedModel = manualMode ? null : math.generatePhysicsModel(parameters);
      let points;
      if (manualMode) points = readSensorRows();
      else points = generatedModel.points;
      sensorPoints = points;
      renderSensorRows(points, manualMode);
      elements.sensorModeDescription.textContent = manualMode
        ? 'Edit three points to explore interpolation independently of the flight settings.'
        : 'Samples are generated from aircraft speed, altitude, gravity, and wind.';
      byId('addSensor').hidden = !manualMode;
      byId('recalculateButton').hidden = !manualMode;
      byId('loadSample').hidden = !manualMode;
      try {
        let nextModel;
        if (manualMode) {
          const fitted = math.fitQuadratic(points);
          const flightTime = Math.sqrt(2 * Math.max(fitted.coefficients[0], 0) / parameters.gravity);
          const landingX = fitted.roots.positiveRoot;
          nextModel = {
            ...fitted,
            basis: 'distance',
            axisLabel: 'horizontal distance (m)',
            releaseAltitude: fitted.coefficients[0],
            flightTime,
            landingTime: flightTime,
            landingX,
            landingDistance: landingX === null ? null : Math.abs(landingX),
            effectiveHorizontalSpeed: flightTime > 0 && landingX !== null ? landingX / flightTime : parameters.aircraftSpeed,
            scenePoints: points.map((point) => ({ ...point })),
            isManual: true
          };
        } else {
          nextModel = generatedModel;
        }
        model = nextModel;
        const verdict = makeFlightVerdict(model);
        flightValid = verdict.valid;
        flightReason = verdict.reason;
        elements.equation.textContent = polynomialText(model.coefficients, model.basis === 'time' ? 't' : 'x');
        elements.coefficientA0.textContent = formatNumber(model.coefficients[0]);
        elements.coefficientA1.textContent = formatNumber(model.coefficients[1]);
        elements.coefficientA2.textContent = formatNumber(model.coefficients[2]);
        const landingX = model.landingX ?? model.roots.positiveRoot;
        const landingDistance = Number.isFinite(model.landingDistance) ? model.landingDistance : landingX === null ? null : Math.abs(landingX);
        elements.equationNote.textContent = model.basis === 'time'
          ? 'altitude y · elapsed time t (s) · vertical drop'
          : 'altitude y · horizontal distance x (m)';
        elements.sensorXAxisUnit.textContent = model.basis === 'time' ? '· time (s)' : '· distance (m)';
        elements.landing.textContent = landingDistance === null ? '—' : `${formatFixed(landingDistance)} m`;
        elements.landingDirection.textContent = landingX === null ? 'no forward landing' : landingX < 0 ? 'left of release' : landingX > 0 ? 'right of release' : 'beneath release';
        elements.hudLanding.innerHTML = landingDistance === null ? '—' : `${formatFixed(landingDistance)} <small>m</small>`;
        elements.resultStatus.textContent = flightReason;
        elements.resultStatus.style.color = flightValid ? 'var(--green)' : 'var(--amber)';
        elements.solverBadge.textContent = 'SOLVED';
        elements.solverBadge.classList.remove('error');
        elements.sceneScaleLabel.textContent = `${landingDistance === null ? '—' : formatFixed(landingDistance)} m`;
        const original = model.matrix.map((row, index) => row.concat(model.values[index]));
        renderMatrix(elements.originalMatrix, original);
        renderMatrix(elements.rrefMatrix, model.rref);
        renderSolutionVector(model.coefficients);
        const flightWasActive = simulation.status !== 'READY';
        stepIndex = 0;
        renderStep();
        clearError();
        if (flightWasActive) resetSimulation();
        else renderPresentation();
        drawVisualizations();
      } catch (error) {
        model = null;
        flightValid = false;
        flightReason = error.message;
        elements.equation.textContent = 'y = —';
        elements.coefficientA0.textContent = '—';
        elements.coefficientA1.textContent = '—';
        elements.coefficientA2.textContent = '—';
        elements.landing.textContent = '—';
        elements.hudLanding.textContent = '—';
        elements.resultStatus.textContent = 'Check sensor data';
        elements.resultStatus.style.color = '#ff9c8c';
        elements.solverBadge.textContent = 'CHECK DATA';
        elements.solverBadge.classList.add('error');
        elements.sceneScaleLabel.textContent = '—';
        renderMatrix(elements.originalMatrix, null);
        renderMatrix(elements.rrefMatrix, null);
        renderMatrix(elements.stepMatrix, null);
        elements.stepLabel.textContent = 'Solver unavailable';
        elements.stepCounter.textContent = '— / —';
        elements.operationText.textContent = 'Correct the sensor values to continue.';
        elements.solutionVector.replaceChildren();
        showError(error.message);
        resetSimulation();
        drawVisualizations();
      }
      updateParameterReadouts(elements);
      if (!model) elements.parameterNotice.textContent = 'Model unavailable; correct the sensor values to continue.';
      else if (simulation.status === 'READY' && elements.parameterNotice.textContent.startsWith('Speed, altitude')) elements.parameterNotice.textContent = '';
      updateControls();
    }

    function resetSimulation() {
      stopStepPlayback();
      flightParameters = null;
      simulation = transitionSimulation(simulation, 'reset');
      previousFrameTime = null;
      presentation = createPresentationState();
      renderPresentation();
      updateControls();
    }

    function lockFlightParameters() {
      const current = readParameters(elements);
      if (model && !model.isManual && Number.isFinite(model.aircraftSpeed)) {
        flightParameters = {
          aircraftSpeed: model.aircraftSpeed,
          altitude: model.releaseAltitude,
          windEnabled: Boolean(model.windEnabled),
          windSpeed: Number(model.windSpeed) || 0,
          windDirection: model.windDirection || 'tailwind',
          gravity: model.gravity || current.gravity
        };
      } else {
        flightParameters = current;
      }
      if (model) {
        const target = visualization.measureSceneDomain(model, { parameters: flightParameters });
        camera = { domainMin: target.domainMin, domainMax: target.domainMax, maxAltitude: target.maxAltitude };
      }
    }

    function dropPackage() {
      if (!flightValid || simulation.status !== 'FLYING') return;
      simulation = transitionSimulation(simulation, 'drop');
      elements.parameterNotice.textContent = '';
      updateControls();
    }

    function updateControls() {
      const status = simulation.status;
      const ready = status === 'READY';
      const flying = status === 'FLYING';
      const falling = status === 'FALLING';
      const paused = status === 'PAUSED';
      const landed = status === 'LANDED' || (paused && simulation.previousState === 'LANDED');
      elements.startButton.disabled = !flightValid || !ready;
      elements.startButton.hidden = !ready;
      elements.dropButton.disabled = !flightValid || !flying;
      elements.pauseButton.disabled = !(flying || falling || landed);
      elements.pauseButton.hidden = paused;
      elements.resumeButton.hidden = !paused;
      elements.resetButton.disabled = false;
      elements.replayButton.hidden = !landed;
      if (status === 'READY') elements.sceneStatus.textContent = flightValid ? 'READY FOR DROP' : 'MODEL NEEDS ATTENTION';
      else if (status === 'FLYING') elements.sceneStatus.textContent = 'AIRCRAFT IN FLIGHT';
      else if (status === 'FALLING') elements.sceneStatus.textContent = 'PACKAGE IN DESCENT';
      else if (status === 'LANDED') elements.sceneStatus.textContent = 'PACKAGE LANDED';
      else if (paused) elements.sceneStatus.textContent = 'SIMULATION PAUSED';
      if (landed) elements.resultStatus.textContent = 'Successful landing';
      else if (flightValid) elements.resultStatus.textContent = flightReason;
      renderPresentation();
    }

    function drawVisualizations(delta = 0) {
      const activeModel = model || { coefficients: [0, 0, 0], points: [], roots: { positiveRoot: null }, flightTime: 0, releaseAltitude: 0, aircraftSpeed: 0 };
      const released = simulation.status === 'FALLING' || simulation.status === 'LANDED'
        || (simulation.status === 'PAUSED' && (simulation.previousState === 'FALLING' || simulation.previousState === 'LANDED'));
      const packagePosition = model && released && model.flightTime > 0
        ? math.positionAtTime(model, simulation.flightElapsed)
        : { x: 0, y: model?.coefficients[0] || 0, modelX: 0, time: 0 };
      const parameters = parametersForFlight();
      const frame = {
        model: activeModel,
        time: simulation.time,
        state: simulation.status,
        previousState: simulation.previousState,
        progress: simulation.progress,
        planeProgress: simulation.planeProgress,
        planeDistance: simulation.planeDistance,
        releasePlaneProgress: simulation.releasePlaneProgress,
        releasePlaneDistance: simulation.releasePlaneDistance,
        packagePosition,
        trajectoryVisible: elements.trajectoryToggle.checked,
        sensorsVisible: elements.sensorToggle.checked,
        sensorLabelsVisible: elements.sensorLabelsToggle.checked,
        landingVisible: elements.landingToggle.checked,
        windIndicatorsVisible: elements.windVisualToggle.checked && parameters.windEnabled,
        parameters,
        planeImage,
        packageImage,
        impactTime: simulation.impactTime,
        domainOverride: updateCamera(activeModel, parameters, delta)
      };
      const sceneViewport = visualization.drawScene(elements.sceneCanvas, frame);
      if (sceneViewport) {
        const tickDistance = niceScaleTick(52 / sceneViewport.xScale);
        elements.sceneScaleLabel.textContent = `${formatNumber(tickDistance, 3)} m`;
        elements.sceneScaleRule.style.width = `${Math.max(15, tickDistance * sceneViewport.xScale)}px`;
      }
      graphViewport = elements.graphToggle.checked ? visualization.drawGraph(elements.graphCanvas, activeModel, {
        sensorsVisible: elements.sensorToggle.checked,
        sensorLabelsVisible: elements.sensorLabelsToggle.checked,
        landingVisible: elements.landingToggle.checked,
        currentPosition: released && model ? packagePosition : null
      }) : null;
      if (model) {
        elements.sceneAltitude.textContent = formatFixed(Math.max(0, packagePosition.y), 1);
      } else {
        elements.sceneAltitude.textContent = '—';
      }
    }

    function animate(timestamp) {
      animationHandle = window.requestAnimationFrame(animate);
      if (previousFrameTime === null) previousFrameTime = timestamp;
      const delta = Math.min(.05, Math.max(0, (timestamp - previousFrameTime) / 1000));
      previousFrameTime = timestamp;
      const previousStatus = simulation.status;
      simulation = advanceSimulation(simulation, delta, parametersForFlight(), model, Number(elements.speedSlider.value));
      if (previousStatus === 'FLYING' && elements.autoDropToggle.checked && simulation.autoDropElapsed >= 1.65) dropPackage();
      if (simulation.status === 'LANDED' && previousStatus !== 'LANDED') updateControls();
      const previousPresentation = presentation;
      presentation = advancePresentation(presentation, delta, simulation, model, 1, presentationMatrixComplete());
      if (previousPresentation.index !== presentation.index) {
        if (presentation.index === PRESENTATION_MATRIX_INDEX) startPresentationMatrix();
        else if (previousPresentation.index === PRESENTATION_MATRIX_INDEX) stopStepPlayback();
        renderPresentation();
      } else if (previousPresentation.playing !== presentation.playing) {
        renderPresentation();
      }
      if (stepPlaybackActive && simulation.status !== 'PAUSED') {
        stepPlaybackElapsed += delta * Number(elements.speedSlider.value);
        while (stepPlaybackElapsed >= .9 && stepIndex < (model?.steps.length || 0) - 1) {
          stepPlaybackElapsed -= .9;
          stepIndex += 1;
          renderStep();
          if (presentationOpen && presentation.index === PRESENTATION_MATRIX_INDEX) renderPresentation();
        }
        if (!model || stepIndex >= model.steps.length - 1) stopStepPlayback();
        if (presentationOpen && presentation.index === PRESENTATION_MATRIX_INDEX && !stepPlaybackActive) renderPresentation();
      }
      drawVisualizations(delta);
    }

    function changeStep(direction) {
      if (!model) return;
      stopStepPlayback();
      stepIndex = Math.max(0, Math.min(model.steps.length - 1, stepIndex + direction));
      renderStep();
      if (presentationOpen) renderPresentation();
    }

    function installImage(file, kind) {
      if (!file) return;
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
      if (!allowed.includes(file.type) || file.size > 8 * 1024 * 1024) {
        elements.artworkMessage.textContent = 'Choose a PNG, JPG, WEBP, or SVG image under 8 MB.';
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const preview = kind === 'plane' ? elements.planePreview : elements.packagePreview;
        const previewLabel = kind === 'plane' ? elements.planePreviewLabel : elements.packagePreviewLabel;
        const previousUrl = kind === 'plane' ? planeObjectUrl : packageObjectUrl;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        if (kind === 'plane') planeObjectUrl = objectUrl;
        else packageObjectUrl = objectUrl;
        if (kind === 'plane') planeImage = image;
        else packageImage = image;
        preview.src = objectUrl;
        preview.hidden = false;
        previewLabel.hidden = true;
        elements.artworkMessage.textContent = `${kind === 'plane' ? 'Plane' : 'Package'} artwork updated.`;
        drawVisualizations();
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        elements.artworkMessage.textContent = 'That image could not be decoded. The Canvas artwork is still available.';
      };
      image.src = objectUrl;
    }

    function resetArtwork() {
      if (planeObjectUrl) URL.revokeObjectURL(planeObjectUrl);
      if (packageObjectUrl) URL.revokeObjectURL(packageObjectUrl);
      planeObjectUrl = null;
      packageObjectUrl = null;
      planeImage = null;
      packageImage = null;
      elements.planePreview.removeAttribute('src');
      elements.packagePreview.removeAttribute('src');
      elements.planePreview.hidden = true;
      elements.packagePreview.hidden = true;
      elements.planePreviewLabel.hidden = false;
      elements.packagePreviewLabel.hidden = false;
      elements.planeUpload.value = '';
      elements.packageUpload.value = '';
      elements.artworkMessage.textContent = 'Default Canvas artwork restored.';
      drawVisualizations();
    }

    elements.startButton.addEventListener('click', () => {
      lockFlightParameters();
      simulation = transitionSimulation(simulation, 'start');
      elements.parameterNotice.textContent = '';
      updateControls();
    });
    elements.dropButton.addEventListener('click', dropPackage);
    elements.pauseButton.addEventListener('click', () => {
      simulation = transitionSimulation(simulation, 'pause');
      updateControls();
    });
    elements.resumeButton.addEventListener('click', () => {
      simulation = transitionSimulation(simulation, 'resume');
      updateControls();
    });
    elements.resetButton.addEventListener('click', () => {
      resetSimulation();
      renderModel();
    });
    elements.replayButton.addEventListener('click', () => {
      lockFlightParameters();
      simulation = transitionSimulation(simulation, 'replay');
      updateControls();
    });
    elements.speedSlider.addEventListener('input', () => {
      elements.speedValue.value = `${Number(elements.speedSlider.value).toFixed(2)}×`;
    });
    const commitParameters = () => {
      updateParameterReadouts(elements);
      if (simulation.status !== 'READY') {
        elements.parameterNotice.textContent = 'Speed, altitude, and wind apply on reset. The current flight is unchanged.';
        return;
      }
      renderModel();
    };
    [elements.aircraftSpeedSlider, elements.altitudeSlider, elements.windSpeedSlider].forEach((input) => {
      input.addEventListener('input', commitParameters);
      input.addEventListener('change', commitParameters);
    });
    elements.windToggle.addEventListener('change', commitParameters);
    elements.windDirection.addEventListener('change', commitParameters);
    [elements.trajectoryToggle, elements.sensorToggle, elements.sensorLabelsToggle, elements.landingToggle, elements.windVisualToggle].forEach((toggle) => {
      toggle.addEventListener('change', drawVisualizations);
    });
    elements.graphToggle.addEventListener('change', () => { byId('graphPanel').hidden = !elements.graphToggle.checked; drawVisualizations(); });
    elements.matrixToggle.addEventListener('change', () => { byId('math-panel').hidden = !elements.matrixToggle.checked; });
    elements.resultsToggle.addEventListener('change', () => { byId('resultPanel').hidden = !elements.resultsToggle.checked; });
    elements.manualModeToggle.addEventListener('change', () => {
      if (elements.manualModeToggle.checked) renderSensorRows(sensorPoints, true);
      renderModel();
    });
    elements.sensorRows.addEventListener('change', (event) => {
      if (elements.manualModeToggle.checked && event.target.matches('.sensor-input')) renderModel();
    });
    elements.sensorRows.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-index]');
      if (!button) return;
      const points = readSensorRows();
      points.splice(Number(button.dataset.removeIndex), 1);
      renderSensorRows(points, true);
      renderModel();
    });
    byId('addSensor').addEventListener('click', () => {
      const points = readSensorRows();
      points.push({ x: NaN, y: NaN });
      renderSensorRows(points, true);
      renderModel();
      elements.sensorRows.querySelector('tr:last-child input')?.focus();
    });
    const loadSample = () => {
      elements.manualModeToggle.checked = true;
      renderSensorRows(DEFAULT_POINTS.map((point) => ({ ...point })), true);
      renderModel();
    };
    byId('loadSample').addEventListener('click', loadSample);
    byId('resetData').addEventListener('click', () => {
      elements.manualModeToggle.checked = false;
      renderModel();
    });
    byId('recalculateButton').addEventListener('click', renderModel);
    byId('stepBack').addEventListener('click', () => changeStep(-1));
    byId('stepForward').addEventListener('click', () => changeStep(1));
    byId('resetSteps').addEventListener('click', () => {
      stopStepPlayback();
      stepIndex = 0;
      renderStep();
      if (presentationOpen) renderPresentation();
    });
    byId('playSteps').addEventListener('click', () => {
      if (!model) return;
      if (stepPlaybackActive) {
        stopStepPlayback();
        if (presentationOpen) renderPresentation();
        return;
      }
      if (stepIndex >= model.steps.length - 1) stepIndex = 0;
      startStepPlayback();
      renderStep();
      if (presentationOpen) renderPresentation();
    });
    elements.presentationToggle.addEventListener('change', () => setPresentationOpen(elements.presentationToggle.checked));
    elements.presentationOpen.addEventListener('click', () => setPresentationOpen(true));
    elements.presentationClose.addEventListener('click', () => setPresentationOpen(false));
    elements.presentationPrevious.addEventListener('click', () => navigatePresentation('previous'));
    elements.presentationNext.addEventListener('click', () => navigatePresentation('next'));
    elements.presentationPlay.addEventListener('click', () => applyPresentationAction('play'));
    elements.presentationPause.addEventListener('click', () => applyPresentationAction('pause'));
    elements.presentationRestart.addEventListener('click', () => applyPresentationAction('restart'));
    elements.planeUpload.addEventListener('change', (event) => installImage(event.target.files[0], 'plane'));
    elements.packageUpload.addEventListener('change', (event) => installImage(event.target.files[0], 'package'));
    byId('resetArtwork').addEventListener('click', resetArtwork);
    elements.fullscreenButton.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        const request = elements.cockpit.requestFullscreen?.();
        if (request) request.catch((error) => {
          elements.parameterNotice.textContent = `Full screen could not start: ${error.message}`;
        });
        else elements.parameterNotice.textContent = 'Full screen is not supported by this browser.';
      } else {
        document.exitFullscreen?.();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const active = document.fullscreenElement === elements.cockpit;
      elements.fullscreenButton.textContent = active ? '⤢' : '⛶';
      elements.fullscreenButton.title = active ? 'Exit full screen' : 'Expand simulation cockpit';
      elements.fullscreenButton.setAttribute('aria-label', elements.fullscreenButton.title);
      window.requestAnimationFrame(drawVisualizations);
    });
    elements.graphCanvas.addEventListener('mousemove', (event) => {
      if (!graphViewport || !model) return;
      const rect = elements.graphCanvas.getBoundingClientRect();
      const xPixel = event.clientX - rect.left;
      const yPixel = event.clientY - rect.top;
      if (xPixel < graphViewport.left || xPixel > graphViewport.right || yPixel < graphViewport.top || yPixel > graphViewport.bottom) {
        elements.graphTooltip.hidden = true;
        return;
      }
      const x = graphViewport.xMin + (xPixel - graphViewport.left) / (graphViewport.right - graphViewport.left) * (graphViewport.xMax - graphViewport.xMin);
      const y = graphViewport.yMax - (yPixel - graphViewport.top) / (graphViewport.bottom - graphViewport.top) * (graphViewport.yMax - graphViewport.yMin);
      const xUnit = model.axisLabel === 'time (s)' ? 's' : 'm';
      elements.graphTooltip.textContent = `x ${formatFixed(x, 2)} ${xUnit}  ·  y ${formatFixed(y, 2)} m`;
      elements.graphTooltip.style.left = `${Math.min(rect.width - 130, xPixel + 10)}px`;
      elements.graphTooltip.style.top = `${Math.max(3, yPixel - 24)}px`;
      elements.graphTooltip.hidden = false;
    });
    elements.graphCanvas.addEventListener('mouseleave', () => { elements.graphTooltip.hidden = true; });
    window.addEventListener('resize', drawVisualizations);

    renderSensorRows(sensorPoints);
    renderModel();
    renderPresentation();
    animationHandle = window.requestAnimationFrame(animate);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(drawVisualizations);
      observer.observe(elements.sceneWrap);
      observer.observe(elements.graphCanvas.parentElement);
    }
    return () => {
      if (animationHandle !== null) window.cancelAnimationFrame(animationHandle);
      stopStepPlayback();
      if (planeObjectUrl) URL.revokeObjectURL(planeObjectUrl);
      if (packageObjectUrl) URL.revokeObjectURL(packageObjectUrl);
    };
  }

  return {
    advancePresentation,
    advanceSimulation,
    canEnterPresentationStep,
    createPresentationState,
    createSimulationState,
    transitionPresentation,
    transitionSimulation,
    init
  };
});