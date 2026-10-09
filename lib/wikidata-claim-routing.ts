export function prioritizeClaimTargets(
  qids: readonly string[],
  priorityTargetQid?: string,
): string[] {
  if (!priorityTargetQid || !qids.includes(priorityTargetQid)) return [...qids];
  return [priorityTargetQid, ...qids.filter((qid) => qid !== priorityTargetQid)];
}
