# HowConnected Chrome extension privacy disclosure

This local prototype runs only when the user opens its popup. It has no background service
worker, content script, analytics, advertising code, or persistent storage.

## Data used for the user-facing feature

- The active tab URL is inspected locally after the toolbar action is clicked. It is used only
  to recognize an `https://en.wikipedia.org/wiki/...` article.
- The decoded article title is sent over HTTPS to English Wikipedia's Action API. The response
  supplies the structured `wikibase_item` QID, resolved title, namespace, redirect handling,
  and disambiguation marker.
- Search text entered by the user is sent over HTTPS to
  `https://www.howconnected.app/api/search` for entity autocomplete.
- The two selected Wikidata QIDs are included in the HowConnected connection URL opened at the
  user's request.

The full article body, full active-tab URL, browsing history, cookies, authentication data, and
form data from other sites are never sent to HowConnected. The extension stores no user data.

Information accessed by this extension is used only to provide its single, user-initiated
connection-finding feature. It is not sold, transferred for advertising, or used for
personalized, retargeted, or interest-based advertising.
