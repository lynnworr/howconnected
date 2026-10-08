"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { SelectedEntity } from "@/components/connection-types";
import { trackProductEvent } from "@/lib/product-analytics";
import { createLatestRequestGuard } from "@/lib/search-pipeline";

type SearchResponse = {
  results?: unknown;
};

type EntitySearchProps = {
  label: string;
  value: string;
  selected: SelectedEntity | null;
  onValueChange: (value: string) => void;
  onSelect: (entity: SelectedEntity) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
};

function isSelectedEntity(value: unknown): value is SelectedEntity {
  if (typeof value !== "object" || value === null) return false;
  const entity = value as Record<string, unknown>;
  return (
    typeof entity.id === "string" &&
    typeof entity.label === "string" &&
    typeof entity.description === "string"
  );
}

export default function EntitySearch({
  label,
  value,
  selected,
  onValueChange,
  onSelect,
  inputRef,
}: EntitySearchProps) {
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<SelectedEntity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const requestGuardRef = useRef(createLatestRequestGuard());

  useEffect(() => {
    const requestGuard = requestGuardRef.current;
    const requestId = requestGuard.begin();
    const query = value.trim();
    if (query.length < 2 || selected?.label === value) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchFailed(false);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search returned ${response.status}`);

        const data: SearchResponse = await response.json();
        if (!Array.isArray(data.results)) throw new Error("Invalid search response");
        if (!requestGuard.isCurrent(requestId)) return;

        const nextSuggestions = data.results
          .filter(isSelectedEntity)
          .slice(0, 6);
        trackProductEvent("entity_search", {
          queryLength: query.length,
          resultCount: nextSuggestions.length,
        });
        setSuggestions(nextSuggestions);
        setHighlightedIndex(nextSuggestions.length > 0 ? 0 : -1);
        setIsOpen(true);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!requestGuard.isCurrent(requestId)) return;
        console.error("Entity search failed", error);
        setSuggestions([]);
        setSearchFailed(true);
        setIsOpen(true);
      } finally {
        if (
          !controller.signal.aborted &&
          requestGuard.isCurrent(requestId)
        ) {
          setIsSearching(false);
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (requestGuard.isCurrent(requestId)) requestGuard.invalidate();
    };
  }, [selected?.label, value]);

  function choose(entity: SelectedEntity) {
    onSelect(entity);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    setIsSearching(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }

    if (
      event.key === "Enter" &&
      isOpen &&
      highlightedIndex >= 0 &&
      suggestions[highlightedIndex]
    ) {
      event.preventDefault();
      choose(suggestions[highlightedIndex]);
    }
  }

  return (
    <div
      className="relative min-w-0 flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <label className="sr-only" htmlFor={`${listboxId}-input`}>
        {label}
      </label>
      <div
        className={`group flex h-[72px] items-center gap-3 rounded-2xl border bg-white px-4 shadow-[0_12px_40px_rgba(18,27,47,0.07)] transition-all focus-within:-translate-y-0.5 focus-within:border-[#ff6846] focus-within:shadow-[0_16px_50px_rgba(255,104,70,0.14)] ${
          selected ? "border-[#9bd8c5]" : "border-[#dfe3ea]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors ${
            selected
              ? "bg-[#dff5ec] text-[#14765b]"
              : "bg-[#f1f3f7] text-[#697386] group-focus-within:bg-[#fff0eb] group-focus-within:text-[#e64f2f]"
          }`}
        >
          {selected ? "✓" : "⌕"}
        </span>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            id={`${listboxId}-input`}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            aria-activedescendant={
              isOpen && highlightedIndex >= 0
                ? `${listboxId}-option-${highlightedIndex}`
                : undefined
            }
            autoComplete="off"
            className="w-full bg-transparent text-[17px] font-semibold text-[#15213b] outline-none placeholder:font-medium placeholder:text-[#9299a8]"
            placeholder="Search anything..."
            value={value}
            onChange={(event) => {
              setSuggestions([]);
              setIsOpen(false);
              setSearchFailed(false);
              setIsSearching(false);
              onValueChange(event.target.value);
            }}
            onFocus={() => {
              if (suggestions.length > 0 || searchFailed) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
          <p className="mt-0.5 truncate text-xs text-[#7a8496]">
            {selected ? selected.description || "Selected entity" : label}
          </p>
        </div>
        {isSearching ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-[#d9dde5] border-t-[#ff6846]"
            aria-label="Searching"
          />
        ) : null}
      </div>

      {isOpen && value.trim().length >= 2 && selected?.label !== value ? (
        <div className="absolute left-0 right-0 top-[80px] z-30 overflow-hidden rounded-2xl border border-[#e0e4eb] bg-white p-1.5 shadow-[0_24px_70px_rgba(18,27,47,0.17)]">
          {searchFailed ? (
            <p className="px-4 py-3 text-sm text-[#9a3f2d]">
              Search is unavailable right now. Please try again.
            </p>
          ) : suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#697386]">
              No matching entities found.
            </p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label={`${label} suggestions`}>
              {suggestions.map((entity, index) => (
                <li
                  id={`${listboxId}-option-${index}`}
                  key={entity.id}
                  role="option"
                  aria-selected={index === highlightedIndex}
                >
                  <button
                    type="button"
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                      index === highlightedIndex
                        ? "bg-[#fff1ec]"
                        : "hover:bg-[#f6f7f9]"
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => choose(entity)}
                  >
                    <span className="block text-sm font-semibold text-[#15213b]">
                      {entity.label}
                    </span>
                    <span className="mt-0.5 block line-clamp-1 text-xs text-[#70798b]">
                      {entity.description || "Wikidata entity"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
