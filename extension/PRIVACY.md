# HowConnected extension privacy disclosure

Version 1.1.0 runs only when a user opens its popup. It has no background service worker,
content script, analytics, advertising code, or persistent storage.

## Information used for the requested feature

- The active tab URL is inspected locally after the toolbar action is clicked to determine
  whether it is a supported English Wikipedia article.
- The decoded article title is sent over HTTPS to English Wikipedia's Action API. Wikipedia
  returns structured redirect, namespace, disambiguation, resolved-title, and Wikidata-QID data.
- Search text entered in the popup is sent over HTTPS to HowConnected's entity-search endpoint.
- The two selected Wikidata QIDs are included in the HowConnected URL opened by the user.
- HowConnected pages opened by the popup include the fixed `source=extension` label so the website
  can measure extension referrals without receiving a page title or personal identifier.

The extension does not send the full article body, full active-tab URL, browsing history,
cookies, authentication data, or form data from other sites to HowConnected. It stores no user data and
makes no requests while closed.

Information accessed by the extension is used only for its single, user-initiated
connection-finding purpose. It is not sold, transferred to data brokers, used for personalized
advertising, or used to create a browsing profile. HowConnected's use of information received
from Chrome APIs complies with the Chrome Web Store User Data Policy, including its Limited Use
requirements.

The public disclosure and support links are:

- Privacy and extension information: https://www.howconnected.app/extension
- Support: https://www.howconnected.app/contact
