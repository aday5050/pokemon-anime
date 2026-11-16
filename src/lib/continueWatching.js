/** Returns the latest episode to resume, the next episode, or the completed finale. */
export function getContinueWatching(seasons, progressData) {
  const episodes = seasons.flatMap((season) => season.episodes.map((episode) => ({
    ...episode,
    seasonId: season.id,
    seasonName: season.name,
  })));

  let latestIndex = -1;
  let latestTime = -Infinity;
  episodes.forEach((episode, index) => {
    const progress = progressData[`${episode.seasonId}_${episode.number}`];
    if (!progress || (progress.finished !== true && !(progress.time > 0))) return;
    const updated = Date.parse(progress.lastUpdated);
    if (Number.isFinite(updated) && updated > latestTime) {
      latestIndex = index;
      latestTime = updated;
    }
  });

  if (latestIndex < 0) return null;
  const latest = episodes[latestIndex];
  const progress = progressData[`${latest.seasonId}_${latest.number}`];
  if (progress.finished !== true) return { kind: 'resume', episode: latest, progress };
  if (latestIndex + 1 < episodes.length) return { kind: 'next', episode: episodes[latestIndex + 1], progress };
  return { kind: 'complete', episode: latest, progress };
}
