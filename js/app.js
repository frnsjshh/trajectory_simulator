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
    'Aircraft speed, release altitude, gravity, and wind generate three altitude readings.',
    'For every measurement we build a row [1, x, x²]. The measured altitudes form the vector B.',
    'Gauss–Jordan elimination uses real row operations and partial pivoting to reduce the augmented matrix.',
    'The solution vector supplies a₀, a₁, and a₂, which reconstruct the measured flight path.',
    'We solve the polynomial for y = 0 and select the intercept in the package’s direction of travel.',
    'The crate now follows the same calculated curve, with the predicted ground point marked below.'
  ];

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
    } else if (action === 'pause' && (state.status === 'FLYING' || state.status === 'FALLING')) {
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
      sceneCanvas: byId('simulationCanvas'), graphCanvas: byId('trajectoryCanvas'), sceneWrap: byId('sceneWrap'),
      sceneStatus: byId('sceneStatus'), sceneAltitude: byId('sceneAltitude'), sceneScaleLabel: byId('sceneScaleLabel'),
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
      presentationToggle: byId('presentationToggle'), presentationStep: byId('presentationStep'), presentationText: byId('presentationText'),
      presentationProgress: byId('presentationProgress'), planeUpload: byId('planeUpload'), packageUpload: byId('packageUpload'),
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
    let presentationIndex = 0;

    function formatNumber(value, digits = 5) {
      if (!Number.isFinite(value)) return '—';
      if (Math.abs(value) < 1e-10) return '0';
      const rounded = Number(value.toPrecision(digits));
      return String(rounded).replace('-', '−');
    }

    function formatFixed(value, digits = 2) {
      return Number.isFinite(value) ? value.toFixed(digits) : '—';
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

    function stopStepPlayback() {
      stepPlaybackActive = false;
      stepPlaybackElapsed = 0;
      byId('playStepsIcon').textContent = '▶';
      byId('playStepsText').textContent = 'Play steps';
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

    function setPresentation(index) {
      presentationIndex = Math.max(0, Math.min(PRESENTATION.length - 1, index));
      elements.presentationStep.textContent = `STEP ${String(presentationIndex + 1).padStart(2, '0')}`;
      elements.presentationText.textContent = PRESENTATION[presentationIndex];
      elements.presentationProgress.style.width = `${((presentationIndex + 1) / PRESENTATION.length) * 100}%`;
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
        stepIndex = 0;
        renderStep();
        clearError();
        resetSimulation();
        drawVisualizations();
        if (elements.presentationToggle.checked) setPresentation(4);
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
      elements.parameterNotice.textContent = model
        ? 'Model refreshed; the flight is back at READY with these parameters.'
        : 'Model unavailable; correct the sensor values to continue.';
      updateControls();
    }

    function resetSimulation() {
      stopStepPlayback();
      simulation = transitionSimulation(simulation, 'reset');
      previousFrameTime = null;
      setPresentation(model ? 4 : 0);
      updateControls();
    }

    function dropPackage() {
      if (!flightValid || simulation.status !== 'FLYING') return;
      simulation = transitionSimulation(simulation, 'drop');
      if (elements.presentationToggle.checked) setPresentation(5);
      updateControls();
    }

    function updateControls() {
      const status = simulation.status;
      const ready = status === 'READY';
      const flying = status === 'FLYING';
      const falling = status === 'FALLING';
      const landed = status === 'LANDED';
      const paused = status === 'PAUSED';
      elements.startButton.disabled = !flightValid || !ready;
      elements.startButton.hidden = !ready;
      elements.dropButton.disabled = !flightValid || !flying;
      elements.pauseButton.disabled = !(flying || falling);
      elements.pauseButton.hidden = paused || landed;
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
      if (landed && elements.presentationToggle.checked) setPresentation(5);
    }

    function drawVisualizations() {
      const activeModel = model || { coefficients: [0, 0, 0], points: [], roots: { positiveRoot: null } };
      const released = simulation.status === 'FALLING' || simulation.status === 'LANDED'
        || (simulation.status === 'PAUSED' && (simulation.previousState === 'FALLING' || simulation.previousState === 'LANDED'));
      const packagePosition = model && released && model.flightTime > 0
        ? math.positionAtTime(model, simulation.flightElapsed)
        : { x: 0, y: model?.coefficients[0] || 0, modelX: 0, time: 0 };
      const parameters = readParameters(elements);
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
        impactTime: simulation.impactTime
      };
      visualization.drawScene(elements.sceneCanvas, frame);
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
      simulation = advanceSimulation(simulation, delta, readParameters(elements), model, Number(elements.speedSlider.value));
      if (previousStatus === 'FLYING' && elements.autoDropToggle.checked && simulation.autoDropElapsed >= 1.65) dropPackage();
      if (simulation.status === 'LANDED' && previousStatus !== 'LANDED') updateControls();
      if (stepPlaybackActive && simulation.status !== 'PAUSED') {
        stepPlaybackElapsed += delta * Number(elements.speedSlider.value);
        while (stepPlaybackElapsed >= .9 && stepIndex < (model?.steps.length || 0) - 1) {
          stepPlaybackElapsed -= .9;
          stepIndex += 1;
          renderStep();
        }
        if (!model || stepIndex >= model.steps.length - 1) stopStepPlayback();
      }
      drawVisualizations();
    }

    function changeStep(direction) {
      if (!model) return;
      stopStepPlayback();
      stepIndex = Math.max(0, Math.min(model.steps.length - 1, stepIndex + direction));
      renderStep();
      if (elements.presentationToggle.checked) setPresentation(2);
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
      simulation = transitionSimulation(simulation, 'start');
      if (elements.presentationToggle.checked) setPresentation(5);
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
    elements.resetButton.addEventListener('click', resetSimulation);
    elements.replayButton.addEventListener('click', () => {
      simulation = transitionSimulation(simulation, 'replay');
      updateControls();
    });
    elements.speedSlider.addEventListener('input', () => {
      elements.speedValue.value = `${Number(elements.speedSlider.value).toFixed(2)}×`;
    });
    [elements.aircraftSpeedSlider, elements.altitudeSlider, elements.windSpeedSlider].forEach((input) => {
      input.addEventListener('input', () => updateParameterReadouts(elements));
      input.addEventListener('change', () => renderModel());
    });
    elements.windToggle.addEventListener('change', () => {
      updateParameterReadouts(elements);
      renderModel();
    });
    elements.windDirection.addEventListener('change', renderModel);
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
    });
    byId('playSteps').addEventListener('click', () => {
      if (!model) return;
      if (stepPlaybackActive) {
        stopStepPlayback();
        return;
      }
      if (stepIndex >= model.steps.length - 1) stepIndex = 0;
      stepPlaybackActive = true;
      stepPlaybackElapsed = 0;
      byId('playStepsIcon').textContent = 'Ⅱ';
      byId('playStepsText').textContent = 'Pause steps';
      renderStep();
      if (elements.presentationToggle.checked) setPresentation(2);
    });
    elements.presentationToggle.addEventListener('change', () => setPresentation(elements.presentationToggle.checked ? 0 : 4));
    elements.planeUpload.addEventListener('change', (event) => installImage(event.target.files[0], 'plane'));
    elements.packageUpload.addEventListener('change', (event) => installImage(event.target.files[0], 'package'));
    byId('resetArtwork').addEventListener('click', resetArtwork);
    byId('sceneFullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) elements.sceneWrap.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
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
    setPresentation(0);
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

  return { advanceSimulation, createSimulationState, transitionSimulation, init };
});