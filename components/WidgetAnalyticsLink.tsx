"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackProductEvent } from "@/lib/product-analytics";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  connection: string;
  destination: "connection" | "wikipedia" | "wikidata" | "evidence" | "publisher_info";
  children: ReactNode;
};

export default function WidgetAnalyticsLink({
  connection,
  destination,
  children,
  onClick,
  ...props
}: Props) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackProductEvent("widget_link_opened", { connection, destination });
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
