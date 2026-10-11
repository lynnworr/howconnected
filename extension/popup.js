/* global chrome */

import {
  HOWCONNECTED_ORIGIN,
  buildConnectionUrl,
  buildSearchUrl,
  buildWikipediaLookupUrl,
  canFindConnection,
  parseSearchResponse,
  parseWikipediaArticleUrl,
  parseWikipediaLookupResponse,
  selectedEntityAfterEdit,
} from "./core.mjs";

const elements = {
  form: document.querySelector("#connection-form"),
  sourceInput: document.querySelector("#source-input"),
  sourceResults: document.querySelector("#source-results"),
  targetInput: document.querySelector("#target-input"),
  targetResults: document.querySelector("#target-results"),
  findButton: document.querySelector("#find-button"),
  changeSource: document.querySelector("#change-source"),
  detectionStatus: document.querySelector("#detection-status"),
  formMessage: document.querySelector("#form-message"),
  openSite: document.querySelector("#open-site"),
  openPrivacy: document.querySelector("#open-privacy"),
};

const state = {
  source: null,
  target: null,
};

function setDetectionStatus(message, tone = "neutral") {
  elements.detectionStatus.textContent = message;
  elements.detectionStatus.dataset.tone = tone;
}

function updateSubmitState() {
  elements.findButton.disabled = !canFindConnection(state.source, state.target);
}

function setSelectedEntity(kind, entity) {
  state[kind] = entity;
  const input = kind === "source" ? elements.sourceInput : elements.targetInput;
  input.value = entity.label;
  input.dataset.qid = entity.id;
  if (kind === "source") elements.changeSource.hidden = false;
  elements.formMessage.textContent = "";
  updateSubmitState();
}

function clearSelectedEntity(kind) {
  state[kind] = null;
  const input = kind === "source" ? elements.sourceInput : elements.targetInput;
  delete input.dataset.qid;
  if (kind === "source") elements.changeSource.hidden = true;
  updateSubmitState();
}

function setupAutocomplete(kind, input, list) {
  let timer = 0;
  let controller = null;
  let requestId = 0;
  let results = [];
  let highlightedIndex = -1;

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    highlightedIndex = -1;
  }

  function highlight(index) {
    highlightedIndex = index;
    const buttons = [...list.querySelectorAll("button")];
    buttons.forEach((button, buttonIndex) => {
      button.setAttribute("aria-selected", String(buttonIndex === index));
    });
    if (buttons[index]) {
      input.setAttribute("aria-activedescendant", buttons[index].id);
      buttons[index].scrollIntoView({ block: "nearest" });
    }
  }

  function choose(entity) {
    setSelectedEntity(kind, entity);
    close();
  }

  function render(nextResults, message = "") {
    results = nextResults;
    list.replaceChildren();
    if (message) {
      const item = document.createElement("li");
      item.className = "result-description";
      item.textContent = message;
      item.style.padding = "10px";
      list.append(item);
    } else {
      results.forEach((entity, index) => {
        const item = document.createElement("li");
        item.setAttribute("role", "none");
        const button = document.createElement("button");
        button.type = "button";
        button.id = `${kind}-option-${index}`;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", "false");
        const label = document.createElement("span");
        label.className = "result-label";
        label.textContent = entity.label;
        const description = document.createElement("span");
        description.className = "result-description";
        description.textContent = entity.description || "Wikidata entity";
        button.append(label, description);
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => choose(entity));
        button.addEventListener("mouseenter", () => highlight(index));
        item.append(button);
        list.append(item);
      });
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (results.length) highlight(0);
  }

  async function search(query, currentRequestId) {
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch(buildSearchUrl(query), {
        headers: { Accept: "application/json" },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Search returned ${response.status}.`);
      const nextResults = parseSearchResponse(await response.json());
      if (currentRequestId !== requestId) return;
      render(nextResults, nextResults.length ? "" : "No matching entities found.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (currentRequestId !== requestId) return;
      render([], "Search is unavailable. Try again shortly.");
    }
  }

  input.addEventListener("input", () => {
    state[kind] = selectedEntityAfterEdit(state[kind], input.value);
    if (!state[kind]) clearSelectedEntity(kind);
    elements.formMessage.textContent = "";
    window.clearTimeout(timer);
    requestId += 1;
    const currentRequestId = requestId;
    const query = input.value.trim();
    if (query.length < 2) {
      controller?.abort();
      close();
      return;
    }
    timer = window.setTimeout(() => search(query, currentRequestId), 350);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") return close();
    if (list.hidden || !results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlight((highlightedIndex + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlight((highlightedIndex - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      choose(results[highlightedIndex]);
    }
  });

  input.addEventListener("blur", () => window.setTimeout(close, 100));
}

async function detectCurrentArticle() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const parsed = parseWikipediaArticleUrl(tab?.url ?? "");
    if (parsed.status !== "article") {
      setDetectionStatus(
        "Open an English Wikipedia article, or choose both entities below.",
        "warning",
      );
      elements.sourceInput.focus();
      return;
    }

    const response = await fetch(buildWikipediaLookupUrl(parsed.title), {
      headers: { Accept: "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error(`Wikipedia returned ${response.status}.`);
    const resolution = parseWikipediaLookupResponse(await response.json());
    if (resolution.status === "found") {
      setSelectedEntity("source", resolution.entity);
      setDetectionStatus(`Recognized ${resolution.entity.label} (${resolution.entity.id}).`, "success");
      elements.targetInput.focus();
      return;
    }
    if (resolution.status === "disambiguation") {
      setDetectionStatus(
        "This is a disambiguation page. Choose a specific first entity below.",
        "warning",
      );
    } else {
      setDetectionStatus(
        "This page does not expose a usable Wikidata entity. Choose one below.",
        "warning",
      );
    }
    elements.sourceInput.value = resolution.title ?? parsed.title;
    elements.sourceInput.select();
  } catch {
    setDetectionStatus(
      "Article detection is unavailable. You can still search for both entities.",
      "warning",
    );
    elements.sourceInput.focus();
  }
}

setupAutocomplete("source", elements.sourceInput, elements.sourceResults);
setupAutocomplete("target", elements.targetInput, elements.targetResults);

elements.changeSource.addEventListener("click", () => {
  clearSelectedEntity("source");
  elements.sourceInput.select();
  elements.sourceInput.focus();
  setDetectionStatus("Choose a different first entity.");
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canFindConnection(state.source, state.target)) {
    elements.formMessage.textContent = state.source?.id === state.target?.id
      ? "Choose two different entities."
      : "Select both entities from the suggestions first.";
    return;
  }
  const url = buildConnectionUrl(state.source.id, state.target.id);
  await chrome.tabs.create({ url });
});

elements.openSite.addEventListener("click", () => chrome.tabs.create({ url: HOWCONNECTED_ORIGIN }));
elements.openPrivacy.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("privacy.html") }));

void detectCurrentArticle();
