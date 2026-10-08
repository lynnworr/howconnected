type FutureAdPlacementProps = {
  placement: "after-connection-content";
};

export default function FutureAdPlacement({
  placement,
}: FutureAdPlacementProps) {
  // Reserved for a possible future ad unit. Intentionally renders nothing.
  void placement;
  return null;
}
