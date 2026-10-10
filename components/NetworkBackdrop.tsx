export default function NetworkBackdrop() {
  return (
    <div aria-hidden="true" className="hc-network-backdrop pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="hc-constellation absolute inset-x-0 top-0 h-auto min-h-[680px] w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMin slice"
        fill="none"
        focusable="false"
      >
        <g className="hc-constellation-drift">
          <g className="hc-network-lines">
            <path d="M-40 174 128 108 268 182 414 92 566 156" />
            <path d="M128 108 192 302 382 354 566 156 706 246" />
            <path d="M382 354 520 498 704 438 824 556" />
            <path d="M706 246 864 142 1018 224 1162 118 1494 206" />
            <path d="M1018 224 1084 386 1264 342 1392 472 1494 430" />
            <path d="M704 438 914 416 1084 386 1198 574" />
            <path d="M520 498 598 688 824 556 942 724" />
          </g>

          <g className="hc-network-secondary">
            <path d="M268 182 382 354 438 246" />
            <path d="M864 142 914 416 1018 224" />
            <path d="M1264 342 1198 574 1392 472" />
          </g>

          <g className="hc-network-nodes">
            {[
              [-18, 174, 2], [128, 108, 3], [268, 182, 2], [414, 92, 2.5],
              [566, 156, 2], [192, 302, 2], [382, 354, 3], [520, 498, 2],
              [706, 246, 2.5], [704, 438, 2], [824, 556, 3], [864, 142, 2],
              [1018, 224, 3], [1084, 386, 2], [1162, 118, 2], [1264, 342, 2.5],
              [1392, 472, 2], [598, 688, 2], [942, 724, 2], [1198, 574, 2],
            ].map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
          </g>

          <g className="hc-network-highlights">
            <circle className="hc-node-aura hc-node-coral" cx="414" cy="92" r="32" />
            <circle className="hc-node-core hc-node-coral" cx="414" cy="92" r="4" />
            <circle className="hc-node-aura hc-node-teal" cx="824" cy="556" r="38" />
            <circle className="hc-node-core hc-node-teal" cx="824" cy="556" r="4.5" />
            <circle className="hc-node-aura hc-node-teal hc-network-secondary" cx="1162" cy="118" r="28" />
            <circle className="hc-node-core hc-node-teal" cx="1162" cy="118" r="3.5" />
            <circle className="hc-node-aura hc-node-coral hc-network-secondary" cx="192" cy="302" r="24" />
            <circle className="hc-node-core hc-node-coral" cx="192" cy="302" r="3.5" />
          </g>
        </g>
      </svg>
    </div>
  );
}
