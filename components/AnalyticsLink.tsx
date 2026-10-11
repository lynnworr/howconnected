"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  trackProductEvent,
  type ProductEventName,
} from "@/lib/product-analytics";

type AnalyticsLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    event: ProductEventName;
    eventProperties?: Record<string, string | number | boolean>;
    children: ReactNode;
  };

export default function AnalyticsLink({
  event,
  eventProperties,
  onClick,
  children,
  ...props
}: AnalyticsLinkProps) {
  return (
    <Link
      {...props}
      onClick={(clickEvent) => {
        trackProductEvent(event, eventProperties);
        onClick?.(clickEvent);
      }}
    >
      {children}
    </Link>
  );
}
