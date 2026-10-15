# Phase 7B - Organic search growth

Prepared: October 14, 2026

## Audit summary

### Already working

- The production origin is centralized as `https://www.howconnected.app` and canonical URLs use it consistently.
- `robots.txt` permits public pages while excluding `/admin` and `/api/`, and points to the production sitemap.
- The sitemap contains the homepage, public information pages, and only snapshot-ready editorial connections. `/daily` is included only after the existing launch gate passes.
- Approved canonical connection pages are indexable. Reversed pairs point to the approved canonical URL but remain noindex. Arbitrary live results and review-gated or stale snapshots remain noindex.
- `/daily-preview` remains noindex and canonicalizes to `/daily`.
- The Explore page renders a `CollectionPage` and `ItemList` JSON-LD graph from the approved editorial collection.
- Approved editorial pages have specific titles, descriptions, dynamic social images, reviewed context, related pages, Wikidata statements, and contextual sources.
- The global header and footer provide ordinary crawlable links to the major public sections.

### Issues addressed

1. The homepage defined only `openGraph.url`. Because Next.js metadata objects merge shallowly, that page-level object replaced the root Open Graph object rather than extending it. The homepage now supplies its complete title, description, type, site name, and URL, plus matching Twitter metadata.
2. Each empty entity field used the same phrase for its screen-reader label and visible helper. The visible text now explains what to choose while the real `<label>` remains intact and is associated with the input. This removes the likely `First entity. First entity.` snippet pattern without weakening accessibility.
3. Homepage links to Explore and Daily were brief utility prompts. A server-rendered learning section now describes and links Search, Explore, The Missing Link, and Methodology in context.
4. Explore now links directly to the review methodology, and Methodology provides contextual next steps back to Search, Explore, and Daily.
5. Approved canonical editorial pages now emit sanitized `WebPage` structured data. Live, reversed, stale, and unapproved results do not receive it.

### Not treated as defects

- `/daily` being absent from the sitemap and noindex before its configured UTC launch is intentional. The existing gate controls both behaviors.
- Allowing crawlers to fetch `/daily-preview` is compatible with its page-level noindex directive; blocking it in `robots.txt` could prevent crawlers from seeing that directive.
- Sitemap priority and change-frequency values are hints, not ranking controls. No artificial `lastModified` timestamp was added.
- The project should not expose live search-result URLs to indexing merely because a path was found.
- A generic page type does not guarantee a Google rich result. Structured data describes the approved content but is not presented as a ranking promise.

## Prioritized editorial opportunities

No search-volume estimate is claimed. Priority reflects recognizable informational intent, strength of the existing reviewed seed, potential for a useful relationship-focused explanation, and subject diversity. Each proposed page must still pass the existing factual and editorial review before publication.

| Priority | Educational topic and likely intent | Distinct HowConnected value | Verified seed and additional review |
| ---: | --- | --- | --- |
| 1 | **Who invented the World Wide Web, and where?** | Explain the inventor relationship, CERN context, and the difference between the web and the internet through a short evidence path. | Seed: `world-wide-web-tim-berners-lee`. Recheck the invention statement, dates, CERN sources, and terminology before expanding. |
| 2 | **How was NASA founded, and what did Eisenhower do?** | Connect an institution to the specific presidential action and founding instrument instead of offering a generic NASA history. | Seed: `nasa-dwight-eisenhower`. Recheck the enabling act, signature date, operational date, and primary government sources. |
| 3 | **What were the Apollo 11 crew roles?** | Preserve role qualifiers so commander, lunar-module pilot, and command-module pilot are not flattened into generic crew membership. | Seed: `apollo-11-neil-armstrong`. Independently verify all three roles and mission dates with NASA sources. |
| 4 | **How did Steve Jobs help found Apple?** | Separate the structured founder relationship from simplified single-founder stories and show the evidence behind the connection. | Seed: `steve-jobs-apple`. Recheck co-founders, incorporation chronology, and the garage wording against primary or high-quality historical sources. |
| 5 | **How did Larry Page and Sergey Brin start Google?** | Use the founder relationship as an entry point into the Stanford research partnership, with clear chronology and co-founder context. | Seed: `google-larry-page`. Add Brin only after relationship-specific verification and review of Stanford and Google sources. |
| 6 | **Who founded Studio Ghibli with Hayao Miyazaki?** | Avoid the common one-person shorthand by explaining the founding relationship and the other verified founders. | Seed: `studio-ghibli-hayao-miyazaki`. Verify the 1985 chronology and every named founder with studio or authoritative film-history sources. |
| 7 | **Who created Star Wars, and how did the franchise begin?** | Connect the creative-work statement to its creator while distinguishing the original film, franchise, and later corporate ownership. | Seed: `star-wars-george-lucas`. Verify scope and dates so creator and ownership relationships are never conflated. |
| 8 | **Michael Jordan's Chicago Bulls career timeline** | Make the two playing stints and their date qualifiers visible rather than presenting an undated team-membership fact. | Seed: `michael-jordan-chicago-bulls`. Recheck both stints and championship context with NBA or Bulls records. |
| 9 | **Why is Paris the capital of France, and what does the date qualifier mean?** | Explain why a current capital statement can coexist with historical capitals and wartime exceptions. | Seed: `france-paris`. Review the 1789 qualifier and historical exceptions with authoritative French historical sources. |
| 10 | **How Walt Disney is connected to The Walt Disney Company** | Explain co-founding and naming without turning a complex company history into a timeless ownership claim. | Seed: `walt-disney-the-walt-disney-company`. Recheck co-founder, company-name, and incorporation chronology before expansion. |

## Publication standard for new organic content

Every new editorial page should have one clear user question, a concise answer, an exact relationship path, visible dates or qualifiers when material, at least one relationship-specific contextual source, direct Wikipedia/Wikidata reading links, a review date, related approved pages, and one canonical orientation. Pages remain noindex until the snapshot, wording, sources, and canonical policy pass the existing validator.

Do not create permutations of entities, autogenerated city/country pages, or templated question pages merely to increase URL count.

## Google Search Console owner checks

Local code cannot establish whether Google has crawled or selected a URL for indexing. After deployment:

1. Confirm the domain property and preferred `https://www.howconnected.app` host.
2. Submit or re-submit `https://www.howconnected.app/sitemap.xml` and record its last-read status.
3. Inspect `/`, `/explore`, `/methodology`, `/daily`, and two approved canonical connection URLs.
4. Confirm the selected canonical matches the declared canonical for each approved page.
5. Inspect a reversed connection URL and `/daily-preview`; both should remain excluded by noindex.
6. Review **Page indexing** for robots blocks, duplicate canonical selection, soft 404s, crawled-not-indexed pages, and server errors.
7. In **Performance**, compare Queries and Pages over a fixed period. Do not infer demand from impressions until data exists.
8. Run Google's Rich Results Test and the Schema Markup Validator on the homepage, Explore, and at least one approved connection page. Generic `WebSite`, `CollectionPage`, and `WebPage` data may validate without qualifying for a special rich result.

## Deployment verification

Deploy to a preview environment first. Inspect rendered HTML—not only the React source—for canonical, robots, title, description, Open Graph, Twitter, and JSON-LD output. Crawl the preview with a small bounded route list, then verify the same routes after production promotion. The October 15, 2026 UTC Daily Challenge launch gate, puzzle schedule, and editorial registry must remain unchanged.
