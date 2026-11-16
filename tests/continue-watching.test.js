import test from 'node:test';
import assert from 'node:assert/strict';
import { getContinueWatching } from '../src/lib/continueWatching.js';

const seasons = [
  { id: 1, name: 'Primera', episodes: [{ number: 1, title: 'Inicio' }, { number: 2, title: 'Despedida' }] },
  { id: 2, name: 'Segunda', episodes: [{ number: 1, title: 'Continuación' }] },
];

test('returns no recommendation without playback history', () => {
  assert.equal(getContinueWatching(seasons, {}), null);
});

test('resumes the most recent unfinished episode, even for legacy progress over ten minutes', () => {
  const result = getContinueWatching(seasons, {
    '1_1': { time: 600, lastUpdated: '2026-01-01T00:00:00Z' },
    '1_2': { time: 1000, lastUpdated: '2026-01-02T00:00:00Z' },
  });
  assert.equal(result.kind, 'resume');
  assert.equal(result.episode.title, 'Despedida');
  assert.equal(result.episode.seasonId, 1);
});

test('moves to the next season only when the latest episode is explicitly finished', () => {
  const result = getContinueWatching(seasons, {
    '1_2': { time: 1400, finished: true, lastUpdated: '2026-01-02T00:00:00Z' },
  });
  assert.equal(result.kind, 'next');
  assert.equal(result.episode.title, 'Continuación');
  assert.equal(result.episode.seasonId, 2);
});

test('returns a completion state at the end of the catalog', () => {
  const result = getContinueWatching(seasons, {
    '2_1': { finished: true, lastUpdated: '2026-01-03T00:00:00Z' },
  });
  assert.equal(result.kind, 'complete');
  assert.equal(result.episode.title, 'Continuación');
});

test('ignores invalid records and unknown episodes', () => {
  assert.equal(getContinueWatching(seasons, {
    '1_1': null,
    '1_2': { time: 0, lastUpdated: 'not-a-date' },
    '99_1': { time: 50, lastUpdated: '2026-01-05T00:00:00Z' },
  }), null);
});
