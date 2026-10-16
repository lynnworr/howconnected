"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { trackProductEvent } from "@/lib/product-analytics";
import {
  WIDGET_COMMERCIAL_INTEREST,
  WIDGET_COMMERCIAL_INTEREST_LABELS,
  WIDGET_REQUEST_SCOPES,
  WIDGET_REQUEST_SCOPE_LABELS,
  type WidgetCommercialInterest,
  type WidgetRequestScope,
} from "@/lib/widget-request-types";

type FieldName =
  | "publisherName"
  | "email"
  | "websiteUrl"
  | "requestedConnection"
  | "intendedUse"
  | "requestScope"
  | "commercialInterest";
type FieldErrors = Partial<Record<FieldName, string>>;
type FormStatus =
  | { kind: "idle"; message: "" }
  | { kind: "success" | "error"; message: string };

const fieldClassName =
  "hc-form-control mt-2 w-full rounded-2xl border px-4 py-3 text-base outline-none transition placeholder:text-[#9aa2b2] disabled:cursor-not-allowed disabled:opacity-60";

export default function PublisherRequestForm() {
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitted) return;
    setPending(true);
    setStatus({ kind: "idle", message: "" });
    setFieldErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);
    const requestScope = formData.get("requestScope") as WidgetRequestScope;
    const commercialInterestValue = formData.get("commercialInterest");
    const commercialInterest = typeof commercialInterestValue === "string"
      ? commercialInterestValue as WidgetCommercialInterest
      : undefined;

    try {
      const response = await fetch("/api/widget-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publisherName: formData.get("publisherName"),
          email: formData.get("email"),
          websiteUrl: formData.get("websiteUrl"),
          requestedConnection: formData.get("requestedConnection"),
          intendedUse: formData.get("intendedUse"),
          requestScope,
          commercialInterest,
          company: formData.get("company"),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        fieldErrors?: FieldErrors;
      } | null;
      if (!response.ok) {
        setFieldErrors(body?.fieldErrors ?? {});
        setStatus({
          kind: "error",
          message: body?.error ?? "Your request could not be sent. Please try again later.",
        });
        return;
      }

      form.reset();
      setSubmitted(true);
      setStatus({
        kind: "success",
        message: body?.message ?? "Your request was received for editorial review.",
      });
      trackProductEvent("publisher_request_submitted", {
        requestScope,
        ...(commercialInterest ? { commercialInterest } : {}),
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Your request could not be sent. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitRequest} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="publisher-name"
          label="Publisher or organization name"
          error={fieldErrors.publisherName}
        >
          <input
            className={fieldClassName}
            id="publisher-name"
            name="publisherName"
            type="text"
            autoComplete="organization"
            minLength={2}
            maxLength={120}
            required
            disabled={pending || submitted}
            aria-invalid={Boolean(fieldErrors.publisherName)}
            aria-describedby={fieldErrors.publisherName ? "publisher-name-error" : undefined}
          />
        </FormField>
        <FormField id="publisher-email" label="Contact email" error={fieldErrors.email}>
          <input
            className={fieldClassName}
            id="publisher-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            disabled={pending || submitted}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "publisher-email-error" : undefined}
          />
        </FormField>
      </div>

      <FormField
        id="publisher-website"
        label="Website URL"
        error={fieldErrors.websiteUrl}
        optional
      >
        <input
          className={fieldClassName}
          id="publisher-website"
          name="websiteUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          maxLength={500}
          placeholder="https://example.com"
          disabled={pending || submitted}
          aria-invalid={Boolean(fieldErrors.websiteUrl)}
          aria-describedby={fieldErrors.websiteUrl ? "publisher-website-error" : "publisher-website-hint"}
        />
        <p id="publisher-website-hint" className="mt-2 text-xs leading-5 text-[#788297]">
          Used only to understand the publishing context. HTTP and HTTPS links are accepted.
        </p>
      </FormField>

      <FormField
        id="requested-connection"
        label="Subject or connection requested"
        error={fieldErrors.requestedConnection}
      >
        <input
          className={fieldClassName}
          id="requested-connection"
          name="requestedConnection"
          type="text"
          minLength={5}
          maxLength={300}
          placeholder="For example: NASA and Katherine Johnson"
          required
          disabled={pending || submitted}
          aria-invalid={Boolean(fieldErrors.requestedConnection)}
          aria-describedby={fieldErrors.requestedConnection ? "requested-connection-error" : "requested-connection-hint"}
        />
        <p id="requested-connection-hint" className="mt-2 text-xs leading-5 text-[#788297]">
          Name both endpoints when possible. Every request is independently researched and reviewed.
        </p>
      </FormField>

      <FormField
        id="intended-use"
        label="Intended use or article context"
        error={fieldErrors.intendedUse}
      >
        <textarea
          className={`${fieldClassName} min-h-36 resize-y`}
          id="intended-use"
          name="intendedUse"
          minLength={10}
          maxLength={3_000}
          required
          disabled={pending || submitted}
          aria-invalid={Boolean(fieldErrors.intendedUse)}
          aria-describedby={fieldErrors.intendedUse ? "intended-use-error" : "intended-use-hint"}
        />
        <p id="intended-use-hint" className="mt-2 text-xs leading-5 text-[#788297]">
          Briefly describe the story, lesson, or publication where the widget may appear.
        </p>
      </FormField>

      <fieldset aria-describedby={fieldErrors.requestScope ? "request-scope-error" : undefined}>
        <legend className="text-sm font-bold text-[#25314b]">Request scope</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {WIDGET_REQUEST_SCOPES.map((scope, index) => (
            <label key={scope} className="hc-form-control flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3">
              <input
                className="mt-1 size-4 accent-[#ee6243]"
                type="radio"
                name="requestScope"
                value={scope}
                defaultChecked={index === 0}
                required
                disabled={pending || submitted}
              />
              <span>{WIDGET_REQUEST_SCOPE_LABELS[scope]}</span>
            </label>
          ))}
        </div>
        {fieldErrors.requestScope ? <FieldError id="request-scope-error" message={fieldErrors.requestScope} /> : null}
      </fieldset>

      <fieldset aria-describedby={fieldErrors.commercialInterest ? "commercial-interest-error" : "commercial-interest-hint"}>
        <legend className="text-sm font-bold text-[#25314b]">
          Would you be interested in paid custom widgets or publisher features?{" "}
          <span className="font-normal text-[#788297]">(optional)</span>
        </legend>
        <p id="commercial-interest-hint" className="mt-1 text-xs leading-5 text-[#788297]">
          This is nonbinding market research. No payment information is collected.
        </p>
        <div className="mt-3 grid gap-3">
          {WIDGET_COMMERCIAL_INTEREST.map((interest) => (
            <label key={interest} className="hc-form-control flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3">
              <input
                className="mt-1 size-4 accent-[#ee6243]"
                type="radio"
                name="commercialInterest"
                value={interest}
                disabled={pending || submitted}
              />
              <span>{WIDGET_COMMERCIAL_INTEREST_LABELS[interest]}</span>
            </label>
          ))}
        </div>
        {fieldErrors.commercialInterest ? <FieldError id="commercial-interest-error" message={fieldErrors.commercialInterest} /> : null}
      </fieldset>

      <div aria-hidden="true" className="absolute -left-[10000px] top-auto size-px overflow-hidden">
        <label htmlFor="publisher-company">Company</label>
        <input id="publisher-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-4 border-t border-[#e8e9ed] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-5 text-[#788297]">
          Your details are sent privately to the HowConnected owner for evaluation and response. Submitting is a request—not an order, guarantee, or approval to publish.
        </p>
        <button
          type="submit"
          disabled={pending || submitted}
          className="hc-primary-button inline-flex min-h-12 shrink-0 items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846] disabled:cursor-wait disabled:opacity-65"
        >
          {submitted ? "Request received" : pending ? "Sending..." : "Submit request"}
        </button>
      </div>

      <p
        role={status.kind === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`min-h-6 rounded-xl px-4 py-3 text-sm font-semibold ${
          status.kind === "success"
            ? "bg-[#e9f8f2] text-[#17634d]"
            : status.kind === "error"
              ? "bg-[#fff0ec] text-[#9b3522]"
              : "hidden"
        }`}
      >
        {status.message}
      </p>
    </form>
  );
}

function FormField({
  id,
  label,
  error,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-[#25314b]">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-[#788297]">(optional)</span>
        ) : (
          <span className="text-[#d34f34]">*</span>
        )}
      </label>
      {children}
      {error ? <FieldError id={`${id}-error`} message={error} /> : null}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return <p id={id} className="mt-2 text-sm font-medium text-[#a83b27]">{message}</p>;
}
