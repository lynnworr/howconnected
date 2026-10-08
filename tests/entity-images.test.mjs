import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichConnectionPath,
  parseEntityImagesResponse,
} from "../lib/connection-images.ts";
import {
  extractP18FileName,
  getEntityInitials,
  normalizeCommonsFileName,
  stripWikimediaHtml,
} from "../lib/entity-image-utils.ts";

function image(overrides = {}) {
  return {
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/example.jpg/320px-example.jpg",
    imageAlt: "Image of Example",
    commonsFileUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    artist: "Example Artist",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    ...overrides,
  };
}

test("selects a preferred, non-deprecated P18 image claim", () => {
  const claims = {
    P18: [
      {
        rank: "normal",
        mainsnak: { datavalue: { value: "Normal.jpg" } },
      },
      {
        rank: "preferred",
        mainsnak: { datavalue: { value: "Preferred.jpg" } },
      },
    ],
  };

  assert.equal(extractP18FileName(claims), "Preferred.jpg");
});

test("ignores deprecated or missing P18 claims", () => {
  assert.equal(
    extractP18FileName({
      P18: [
        {
          rank: "deprecated",
          mainsnak: { datavalue: { value: "Old.jpg" } },
        },
      ],
    }),
    null,
  );
  assert.equal(extractP18FileName({}), null);
});

test("normalizes Commons filenames and safe attribution text", () => {
  assert.equal(normalizeCommonsFileName("File:Steve_Jobs.jpg"), "Steve Jobs.jpg");
  assert.equal(
    stripWikimediaHtml('<a href="/wiki/User:Example">Example&nbsp;Artist</a> &amp; team'),
    "Example Artist & team",
  );
});

test("creates stable initials for image fallbacks", () => {
  assert.equal(getEntityInitials("Steve Jobs"), "SJ");
  assert.equal(getEntityInitials("Pixar"), "PI");
  assert.equal(getEntityInitials(""), "?");
});

test("parses image API data and enriches matching path nodes", () => {
  const parsed = parseEntityImagesResponse({
    images: { Q1: image(), Q2: null },
  });
  assert.ok(parsed);

  const path = enrichConnectionPath(
    {
      steps: 1,
      nodes: [
        { name: "Example", type: "person", qid: "Q1" },
        { name: "No image", type: "entity", qid: "Q2" },
      ],
      relationships: [{ label: "knows", from: "Example", to: "No image" }],
    },
    parsed,
  );

  assert.equal(path.nodes[0].imageUrl, image().imageUrl);
  assert.equal(path.nodes[0].imageAlt, "Image of Example");
  assert.equal(path.nodes[1].imageUrl, undefined);
});

test("rejects malformed image API data", () => {
  assert.equal(parseEntityImagesResponse({ images: { Q1: { imageUrl: 42 } } }), null);
});
