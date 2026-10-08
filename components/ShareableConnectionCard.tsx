import ConnectionPath from "@/components/ConnectionPath";
import type { ConnectionPathData } from "@/components/connection-types";
import type { EntityImageMap } from "@/lib/connection-images";

type ShareableConnectionCardProps = {
  sourceName: string;
  targetName: string;
  path: ConnectionPathData;
  images: EntityImageMap;
};

export default function ShareableConnectionCard({
  sourceName,
  targetName,
  path,
  images,
}: ShareableConnectionCardProps) {
  const credits = path.nodes.flatMap((node) => {
    const image = node.qid ? images[node.qid] : null;
    return image ? [{ node, image }] : [];
  });

  return (
    <div className="mx-auto max-w-[68rem]">
      <div className="mb-4 flex flex-col items-center justify-between gap-2 border-b border-[#e6e7e8] pb-3 sm:flex-row sm:text-left">
        <div className="text-center sm:text-left">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">
            Connection path
          </p>
          <h3 className="mt-0.5 text-balance text-lg font-bold tracking-[-0.025em] text-[#15213b] sm:text-xl">
            {sourceName} <span className="text-[#a1a8b4]">→</span> {targetName}
          </h3>
          <p className="mt-0.5 text-xs text-[#7a8291]">
            Connected in {path.steps} {path.steps === 1 ? "step" : "steps"}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#59647a]">
          <span className="relative grid size-6 place-items-center rounded-full bg-[#17233f]">
            <span className="absolute left-[5px] size-1 rounded-full bg-[#ff795b]" />
            <span className="absolute right-[5px] size-1 rounded-full bg-[#58bea0]" />
            <span className="h-px w-3 rotate-[-18deg] bg-white/75" />
          </span>
          HowConnected
        </div>
      </div>

      <ConnectionPath path={path} sourceContext="share_card" />

      {credits.length > 0 ? (
        <details className="mt-4 border-t border-[#e8e9eb] pt-3 text-left">
          <summary className="w-fit cursor-pointer text-[11px] font-semibold text-[#7b8495] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">
            Image credits
          </summary>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#70798b]">
            {credits.map(({ node, image }) => (
              <li key={`${node.qid}-${image.imageUrl}`}>
                <a
                  href={image.commonsFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#46516a] underline decoration-[#cbd1da] underline-offset-2 hover:text-[#c9472d]"
                >
                  {node.name}
                </a>{" "}
                — {image.artist}. {" "}
                <a
                  href={image.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-[#cbd1da] underline-offset-2 hover:text-[#c9472d]"
                >
                  {image.licenseName}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
