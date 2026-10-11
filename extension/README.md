# HowConnected Chrome extension MVP

This folder is a dependency-free Manifest V3 extension. It recognizes the current English
Wikipedia article through the structured MediaWiki API, lets the user change either entity,
and opens the existing HowConnected connection route.

## Load the unpacked extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository's `extension` folder.
5. Open an English Wikipedia article and click the HowConnected toolbar action.

Pin the extension from Chrome's Extensions menu if you want the icon to remain visible. This is
a local prototype and is not packaged or published to the Chrome Web Store.

## Permissions

- `activeTab`: reads the URL of only the active tab after the user clicks the extension. It does
  not grant browsing-history access or background monitoring.
- `https://en.wikipedia.org/*`: calls only `/w/api.php` to resolve the visible article title to
  its structured Wikidata QID and identify redirects or disambiguation pages.
- `https://www.howconnected.app/*`: calls `/api/search` for autocomplete and opens the selected
  `/connect/{fromQid}/{toQid}` page. No database credentials or server keys are present here.

The manifest does not request `tabs`, `history`, `storage`, `cookies`, `webRequest`, `scripting`,
`<all_urls>`, background execution, or content-script access.

No permissive CORS response was added to the website. Manifest host permissions authorize the
two fixed cross-origin destinations inside the extension. Autocomplete is debounced, aborts
superseded requests, requires at least two characters, and caps input at 100 characters. The
existing backend still caps results, caches lookups, and observes its Wikimedia cooldown; its
server-side query handler now also rejects queries over 100 characters before any upstream call.

## Network requests

| Destination | Trigger | Data transmitted | Purpose |
| --- | --- | --- | --- |
| `https://en.wikipedia.org/w/api.php` | Popup opens on an English Wikipedia article | Decoded article title and fixed API parameters | Resolve redirects, namespace, disambiguation state, and `wikibase_item` QID |
| `https://www.howconnected.app/api/search` | User types at least two characters | Search text | Return bounded Wikidata entity suggestions |
| `https://www.howconnected.app/connect/{QID}/{QID}` | User selects both entities and submits | Two Wikidata QIDs in the URL | Open the existing server-side connection experience |

All fetches use HTTPS, omit credentials, and suppress the referrer. No full article content or
full active-tab URL is transmitted to HowConnected. The popup makes no requests while closed.

## Local checks

From the repository root:

```powershell
npm.cmd run test:extension
npm.cmd run lint
npx.cmd tsc --noEmit
```

## Known MVP limitations

- Only canonical `https://en.wikipedia.org/wiki/...` browser URLs are recognized automatically.
- Mobile Wikipedia, other language editions, diff/history pages, and `w/index.php` URLs fall back
  to manual entity search.
- Detection and autocomplete require network access.
- The prototype does not yet include production PNG toolbar icons, automated Chrome UI tests,
  or a published web privacy-policy URL.
