# HowConnected for Wikipedia

This folder is the unpacked source for the dependency-free Manifest V3 extension. Version
1.0.0 recognizes a standard English Wikipedia article through the structured MediaWiki API,
lets the user confirm or replace that entity, and opens a selected connection on HowConnected.

## Install an unpacked build

1. Run `npm.cmd run package:extension` from the repository root. This regenerates and validates
   the committed PNG icons and creates the versioned store ZIP in `dist/`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this repository's `extension` folder.
5. Open a standard `https://en.wikipedia.org/wiki/...` article and click HowConnected.
6. Optionally pin HowConnected from Chrome's Extensions menu.

When testing source changes, return to `chrome://extensions` and click the extension's reload
button. If `manifest.json` changed, close any open popup and reload before testing again.

## Store installation and upgrades

After publication, users install the extension from its Chrome Web Store listing. Chrome handles
updates automatically when a ZIP with a higher manifest version is approved and published. For
each release:

1. Update `version` in `manifest.json` using Chrome's numeric version format.
2. Update user-facing version references and release notes.
3. Run `npm.cmd run package:extension` twice and confirm the printed SHA-256 is identical.
4. Manually test the packaged version from a clean Chrome profile.
5. Upload the matching `dist/howconnected-extension-{version}.zip` in the dashboard.

Never reuse a version number already uploaded to the Chrome Web Store.

## Permissions

- `https://en.wikipedia.org/*` permits the popup to recognize the active tab only when it is an
  English Wikipedia page and to make a structured `/w/api.php` lookup for redirect,
  disambiguation, namespace, title, and Wikidata QID resolution.
- `https://www.howconnected.app/*` permits bounded `/api/search` autocomplete requests and the
  user-requested connection-page navigation.

There are no API permissions and no background worker, content script, persistent storage, remote executable code,
analytics, advertising code, or access to history, cookies, form data, or article content.

## Network inventory

| Destination | Trigger | Data transmitted | Purpose |
| --- | --- | --- | --- |
| `https://en.wikipedia.org/w/api.php` | Popup opens on a supported article | Decoded article title and fixed API parameters | Resolve redirect, namespace, disambiguation state, and Wikidata QID |
| `https://www.howconnected.app/api/search` | User enters at least two characters | Search text | Return up to six Wikidata entity suggestions |
| `https://www.howconnected.app/connect/{QID}/{QID}` | User submits two entities | Two selected Wikidata QIDs in the URL | Open the existing HowConnected connection experience |

All requests use HTTPS, omit credentials, and suppress the referrer. No full article body or full
active-tab URL is sent to HowConnected. The popup makes no requests while closed.

## Validation

```powershell
npm.cmd run test:extension
npm.cmd run package:extension
npm.cmd run lint
npx.cmd tsc --noEmit
```

The package script uses an explicit runtime-file allowlist. The ZIP excludes repository code,
tests, reports, documentation, environment files, credentials, and server dependencies.

## Current detection limits

- Automatic detection supports standard HTTPS English Wikipedia `/wiki/...` article URLs.
- Mobile Wikipedia, other languages, history/diff pages, and `w/index.php` URLs use manual search.
- Detection and autocomplete require network connectivity.
- Ambiguous, missing, unsupported, and unavailable articles fail into the editable search form.
