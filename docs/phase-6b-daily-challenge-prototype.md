# Phase 6B daily challenge prototype

Reviewed: October 11, 2026

## Prototype content

The fixed registry contains four reviewed puzzles:

1. **Find the Missing Link:** World Wide Web → Tim Berners-Lee → CERN. The edges are inventor (P61) and employer (P108), including the relevant 1984–1994 CERN employment period.
2. **Guess the Connection:** Apollo 11 → Neil Armstrong. Crew member (P1029), qualified as spacecraft commander.
3. **Guess the Connection:** Michael Jordan → Chicago Bulls. Member of sports team (P54), preserving the 1984–1993 and 1995–1998 stints.
4. **Guess the Connection:** France → Paris. Capital (P36), preserving the preferred statement’s 5 October 1789 start date and the existence of separate historical statements.

All currently approved editorial connections are one-edge paths. Therefore only the three Guess the Connection puzzles can come directly from the approved collection. The single Missing Link puzzle has a separate reviewed two-edge record backed by CERN and Wikidata. No additional Missing Link puzzle was invented merely to enlarge the schedule.

The route rotates these four puzzles at 00:00 UTC and explicitly tells visitors that they repeat. It is marked `noindex` and is not added to the sitemap while it remains an experiment.

## Mechanic comparison

Scores are relative, from 1 (weak) to 5 (strong). Verification burden and cost use 5 to mean high.

| Criterion | Find the Missing Link | Guess the Connection | Practical observation |
| --- | ---: | ---: | --- |
| Ease of understanding | 4 | 5 | Both fit one screen, but Guess needs less explanation and no hidden-path notation. |
| Entertainment value | 5 | 4 | Revealing a central entity creates a stronger “aha” moment. |
| Content availability | 1 | 5 | The approved collection has no multi-step paths and ten usable direct relationships. |
| Verification burden | 5 | 2 | Missing Link requires two independently verified edges, direction, qualifiers, and unambiguous options. |
| Repeat-visit potential | 4 | 4 | Either can rotate quickly once the reviewed pool grows. |
| Social-sharing potential | 5 | 4 | The unrevealed middle node is naturally shareable without spoiling the answer. |
| Accessibility | 4 | 5 | Guess has shorter labels and a simpler relationship model for screen readers. |
| Development cost | 3 | 2 | The interaction code is similar; Missing Link needs extra path rendering and validation. |
| Ongoing operating cost | 5 | 2 | Editorial review, ambiguity checks, and distractor review dominate Missing Link maintenance. |

## Recommendation

Use **Guess the Connection** for a first production retention experiment. It fits the existing reviewed inventory, is easier to explain and verify, and can launch without manufacturing multi-step paths. Keep **Find the Missing Link** as the more distinctive premium mechanic to expand only when HowConnected has a larger reviewed collection of meaningful multi-step paths.

This recommendation is based on the implemented prototype’s content and interaction constraints, not claimed engagement data. Production traffic is still required to learn whether either mechanic improves return visits.

## Local retention and privacy

- Completion dates, current streak, and best streak are stored only in browser `localStorage`.
- Event deduplication uses browser `sessionStorage` with a puzzle ID and UTC date, not a user identifier.
- The scheduled day rolls over at 00:00 UTC regardless of local timezone.
- A repeated completion for the same UTC date does not increment the streak or emit another completion event.
- Local progress does not sync across browsers or devices and is capped to 60 completed date keys.
- Skipped days reset the optional current streak, with no countdown, warning, or penalty language.

Analytics properties are limited to the reviewed puzzle ID, format, UTC date, surface, correctness boolean, and successful share method. Answer text, selected answer IDs, raw search queries, full URLs, and personal identifiers are not sent.
