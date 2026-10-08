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
    <div className="mx-auto max-w-5xl rounded-[24px] border border-[#dfe3e9] bg-white p-4 shadow-[0_16px_50px_rgba(23,34,56,0.08)] sm:p-6">
      <div className="mb-6 flex flex-col items-center justify-between gap-3 border-b border-[#eceef1] pb-5 sm:flex-row sm:text-left">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ee6243]">
            Connection path
          </p>
          <h3 className="mt-1 text-balance text-xl font-bold tracking-[-0.025em] text-[#15213b] sm:text-2xl">
            {sourceName} <span className="text-[#a1a8b4]">→</span> {targetName}
          </h3>
          <p className="mt-1 text-sm text-[#70798b]">
            Connected in {path.steps} {path.steps === 1 ? "step" : "steps"}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#26334f]">
          <span className="relative grid size-7 place-items-center rounded-full bg-[#17233f]">
            <span className="absolute left-[6px] size-1.5 rounded-full bg-[#ff795b]" />
            <span className="absolute right-[6px] size-1.5 rounded-full bg-[#58bea0]" />
            <span className="h-px w-3.5 rotate-[-18deg] bg-white/75" />
          </span>
          HowConnected
        </div>
      </div>

      <ConnectionPath path={path} sourceContext="share_card" />

      {credits.length > 0 ? (
        <details className="mt-6 border-t border-[#eceef1] pt-4 text-left">
          <summary className="cursor-pointer text-xs font-bold text-[#687186] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]">
            Image credits
          </summary>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-[#70798b]">
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
