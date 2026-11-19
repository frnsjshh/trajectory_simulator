const test = require('node:test');
const assert = require('node:assert/strict');
const {
  advancePresentation,
  canEnterPresentationStep,
  createPresentationState,
  transitionPresentation
} = require('../js/app.js');

const model = { coefficients: [90, 0, -0.01], landingX: 94.868, flightTime: 4.28, steps: [{}, {}] };

test('manual presentation navigation moves exactly one eligible step and waits for required events', () => {
  let presentation = createPresentationState();
  const ready = { status: 'READY', previousState: 'READY' };
  presentation = transitionPresentation(presentation, 'next', ready, model);
  assert.equal(presentation.index, 0);

  const flying = { status: 'FLYING', previousState: 'FLYING' };
  presentation = transitionPresentation(presentation, 'next', flying, model);
  assert.equal(presentation.index, 1);
  presentation = transitionPresentation(presentation, 'next', flying, model);
  assert.equal(presentation.index, 1);

  const falling = { status: 'FALLING', previousState: 'FALLING' };
  presentation = transitionPresentation(presentation, 'next', falling, model);
  assert.equal(presentation.index, 2);
  presentation = transitionPresentation(presentation, 'previous', falling, model);
  assert.equal(presentation.index, 1);
});

test('autoplay waits for animation events and advances at most one step per frame', () => {
  let presentation = transitionPresentation(createPresentationState(), 'play');
  presentation = advancePresentation(presentation, 2, { status: 'READY' }, model, 1);
  assert.equal(presentation.index, 0);
  assert.equal(presentation.playing, true);

  presentation = advancePresentation(presentation, 0.01, { status: 'FLYING' }, model, 1);
  assert.equal(presentation.index, 1);
  assert.equal(presentation.elapsed, 0);
  presentation = advancePresentation(presentation, 2, { status: 'FLYING' }, model, 1);
  assert.equal(presentation.index, 1);
  assert.equal(presentation.playing, true);

  presentation = advancePresentation(presentation, 0.01, { status: 'FALLING' }, model, 1);
  assert.equal(presentation.index, 2);
});

test('Gauss-Jordan presentation step waits for the real matrix playback to finish', () => {
  const falling = { status: 'FALLING', previousState: 'FALLING' };
  const matrixStep = { index: 5, playing: true, elapsed: 1.15 };
  assert.equal(canEnterPresentationStep(6, model, falling, false), false);
  assert.equal(transitionPresentation(matrixStep, 'next', falling, model, false).index, 5);
  assert.equal(advancePresentation(matrixStep, 2, falling, model, 1, false).index, 5);
  assert.equal(advancePresentation(matrixStep, 0.01, falling, model, 1, true).index, 6);
});

test('pause freezes autoplay, restart returns to the first step, and final result waits for landing', () => {
  let presentation = transitionPresentation(createPresentationState(), 'play');
  presentation = advancePresentation(presentation, 0.6, { status: 'FLYING' }, model, 1);
  const presentationPause = transitionPresentation(presentation, 'pause', { status: 'FLYING' }, model);
  assert.equal(presentationPause.elapsed, presentation.elapsed);
  const presentationResume = transitionPresentation(presentationPause, 'play', { status: 'FLYING' }, model);
  assert.equal(advancePresentation(presentationResume, 0.6, { status: 'FLYING' }, model, 1).index, 1);
  const pausedSimulation = { status: 'PAUSED', previousState: 'FLYING' };
  assert.deepEqual(advancePresentation(presentation, 1, pausedSimulation, model, 1), presentation);

  assert.equal(canEnterPresentationStep(9, model, { status: 'FALLING' }), false);
  assert.equal(canEnterPresentationStep(9, model, { status: 'LANDED' }), true);
  assert.deepEqual(
    advancePresentation({ index: 8, playing: true, elapsed: 1.15 }, 0, { status: 'LANDED' }, model),
    { index: 9, playing: false, elapsed: 0 }
  );
  presentation = transitionPresentation(presentation, 'pause', { status: 'FLYING' }, model);
  presentation = transitionPresentation(presentation, 'restart', { status: 'FLYING' }, model);
  assert.deepEqual(presentation, createPresentationState());
});