"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CONTACT_CATEGORIES } from "@/lib/contact-types";

type FieldErrors = Partial<Record<"name" | "email" | "category" | "message", string>>;
type FormStatus =
  | { kind: "idle"; message: "" }
  | { kind: "success" | "error"; message: string };

const fieldClassName =
  "mt-2 w-full rounded-2xl border border-[#d9dee7] bg-white px-4 py-3 text-base text-[#15213b] shadow-sm outline-none transition placeholder:text-[#9aa2b2] focus:border-[#58bea0] focus:ring-4 focus:ring-[#58bea0]/15 disabled:cursor-not-allowed disabled:bg-[#f2f2ef]";

export default function ContactForm() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus({ kind: "idle", message: "" });
    setFieldErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          category: formData.get("category"),
          message: formData.get("message"),
          website: formData.get("website"),
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
          message: body?.error ?? "Your message could not be sent. Please try again later.",
        });
        return;
      }
      form.reset();
      setStatus({
        kind: "success",
        message: body?.message ?? "Your message was sent successfully.",
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Your message could not be sent. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitContact} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="contact-name" label="Name" error={fieldErrors.name}>
          <input
            className={fieldClassName}
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
          />
        </FormField>
        <FormField id="contact-email" label="Email address" error={fieldErrors.email}>
          <input
            className={fieldClassName}
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
          />
        </FormField>
      </div>

      <FormField id="contact-category" label="Subject" error={fieldErrors.category}>
        <select
          className={fieldClassName}
          id="contact-category"
          name="category"
          defaultValue="General Feedback"
          required
          disabled={pending}
          aria-invalid={Boolean(fieldErrors.category)}
          aria-describedby={fieldErrors.category ? "contact-category-error" : undefined}
        >
          {CONTACT_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </FormField>

      <FormField id="contact-message" label="Message" error={fieldErrors.message}>
        <textarea
          className={`${fieldClassName} min-h-40 resize-y`}
          id="contact-message"
          name="message"
          minLength={10}
          maxLength={5_000}
          required
          disabled={pending}
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={fieldErrors.message ? "contact-message-error" : "contact-message-hint"}
        />
        <p id="contact-message-hint" className="mt-2 text-xs leading-5 text-[#788297]">
          Please include the connection names or URL when reporting an incorrect path.
        </p>
      </FormField>

      <div aria-hidden="true" className="absolute -left-[10000px] top-auto size-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-4 border-t border-[#e8e9ed] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-xs leading-5 text-[#788297]">
          Your contact details are used only to respond to this message. No account is required.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#17233f] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(23,35,63,0.18)] transition hover:bg-[#263653] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ff6846] disabled:cursor-wait disabled:opacity-65"
        >
          {pending ? "Sending..." : "Send message"}
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
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-bold text-[#25314b]">
        {label} <span className="text-[#d34f34]">*</span>
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-[#a83b27]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
