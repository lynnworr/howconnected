# Chrome Web Store listing — HowConnected for Wikipedia

## Product details

**Extension title**  
HowConnected for Wikipedia

**Short description**  
Start with the English Wikipedia article you are reading and discover how its subject connects to another entity.

**Suggested category**  
Productivity

**Default language**  
English

**Homepage URL**  
https://www.howconnected.app/extension

**Support URL**  
https://www.howconnected.app/contact

**Privacy policy URL**  
https://www.howconnected.app/extension

## Full description

HowConnected for Wikipedia turns the article you are reading into the starting point for a
connection search.

Open a standard English Wikipedia article, click the HowConnected icon, and the extension uses
Wikipedia's structured API to identify the article's Wikidata entity. Confirm or change that
entity, search for a second person, place, organization, creative work, or idea, and open the
connection on HowConnected.

Features:

- Structured Wikipedia-to-Wikidata detection, including redirect handling
- Clear handling for disambiguation, unsupported, missing, and offline states
- Editable starting entity and keyboard-accessible autocomplete
- Direct navigation to the canonical HowConnected connection route
- No browsing-history collection, background monitoring, analytics, or advertising
- No account required and no paid features

HowConnected uses Wikidata relationships and applies quality safeguards before showing a path.
Some pairs may not have a sufficiently strong connection yet.

Automatic recognition currently supports standard English Wikipedia article URLs. Other sites,
language editions, mobile Wikipedia, history pages, and unsupported Wikipedia routes fall back to
manual entity search.

## Promotional copy

**One-line**  
Turn any English Wikipedia rabbit hole into a new connection.

**Short promotional paragraph**  
Reading about someone, somewhere, or something fascinating? HowConnected recognizes the current
English Wikipedia subject and lets you trace a meaningful Wikidata connection to another entity
in a few clicks.

## Privacy practices dashboard

**Single purpose**  
Identify the English Wikipedia article the user is actively viewing and let the user open a
HowConnected search between its Wikidata entity and another entity they select.

**Host permission: `https://en.wikipedia.org/*`**  
Required to recognize the active tab only when it is an English Wikipedia page and call English
Wikipedia's structured Action API for the article's redirect, namespace, disambiguation state,
resolved title, and Wikidata QID. Other active-tab URLs are not available through this permission.

**Host permission: `https://www.howconnected.app/*`**  
Required for the user-facing entity autocomplete request and to open the requested connection on
HowConnected. Requests omit credentials and referrer information.

**Remote code declaration**  
Select **No, I am not using remote code**. All executable HTML, CSS, JavaScript, and modules are
packaged in the extension. JSON API responses are data and are not executed.

**Data-use declaration guidance**  
Disclose web browsing activity because the extension handles the active tab URL locally, even
though it is user-initiated, never retained, and only the decoded Wikipedia article title is sent
to Wikipedia. Also disclose user-entered search text in whichever current dashboard category
covers user-provided content or search activity. Certify that data is used only for the disclosed
single purpose, is not sold or used for lending, and is not used for personalized advertising.
Review the dashboard's current category wording before submission.

## Screenshot checklist

Chrome currently accepts one to five 1280×800 screenshots. Capture from a clean Chrome profile
with no personal bookmarks, account details, unrelated tabs, or developer tooling visible.

1. Recognized article: Albert Einstein detected with the destination field ready.
2. Autocomplete: useful destination suggestions and visible keyboard focus.
3. Fallback: unsupported page state with both entity fields available.
4. Result handoff: the canonical HowConnected connection page opened from the extension.
5. Privacy: the public extension information page showing minimal permissions.

Required/expected dashboard artwork to prepare manually:

- Store icon: `icons/icon-128.png` (128×128 PNG)
- At least one screenshot: 1280×800 PNG or JPEG; up to five
- Small promotional tile: 440×280 PNG or JPEG
- Optional marquee promotional tile: 1400×560 PNG or JPEG
- Promotional video URL if the dashboard requires or the launch plan includes one

Do not stretch the toolbar icon into promotional artwork; recreate the network motif at the
target dimensions and keep claims consistent with the actual extension.

## Release notes — 1.0.0

Initial public release. Adds user-initiated English Wikipedia article detection, Wikidata entity
confirmation, destination autocomplete, and direct HowConnected connection navigation with
minimal permissions and no stored browsing data.
