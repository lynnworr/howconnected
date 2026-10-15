import {
  canRenderAdvertising,
  type AdPlacement,
  type AdvertisingActivation,
} from "@/lib/advertising-readiness";

type FutureAdPlacementProps = {
  placement: AdPlacement;
  activation?: AdvertisingActivation;
};

export default function FutureAdPlacement({
  placement,
  activation,
}: FutureAdPlacementProps) {
  if (!canRenderAdvertising(activation)) return null;

  return (
    <aside
      aria-label="Advertisement"
      className="mx-auto my-10 min-h-[250px] w-full max-w-4xl rounded-2xl border border-[#dfe2e5] bg-white/35 px-4 py-3"
      data-ad-placement={placement}
    >
      <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-[#657087]">
        Advertisement
      </p>
      <div className="min-h-[220px]" aria-hidden="true" />
    </aside>
  );
}
