export function highestFiniteDistanceKm(
  ...distances: Array<number | undefined>
): number | undefined {
  const finiteDistances = distances.filter((distance): distance is number => (
    typeof distance === 'number' && Number.isFinite(distance)
  ));

  return finiteDistances.length ? Math.max(...finiteDistances) : undefined;
}
