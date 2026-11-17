import test from "node:test";
import assert from "node:assert/strict";
import { validateDocumentLink } from "../lib/document-link.ts";

const valid = { title: "  Network Daily Job  ", description: "  Pintasan harian  ", category: "  ", url: "  https://contoh.test/sites/contoh/Documents/daily  ", isPrimary: false };

test("document link: validasi HTTPS dan normalisasi", () => {
  assert.deepEqual(validateDocumentLink(valid), {
    title: "Network Daily Job",
    description: "Pintasan harian",
    category: "Lainnya",
    url: "https://contoh.test/sites/contoh/Documents/daily",
    isPrimary: false,
  });
});

test("document link: menolak URL kosong dan skema selain HTTPS", () => {
  for (const url of ["", "javascript:alert(1)", "http://contoh.test", "data:text/plain,halo", "file:///tmp/a"]) {
    assert.equal(typeof validateDocumentLink({ ...valid, url }), "string");
  }
});

test("document link: batas panjang title, description, category, dan URL", () => {
  assert.match(String(validateDocumentLink({ ...valid, title: "x".repeat(121) })), /120/);
  assert.match(String(validateDocumentLink({ ...valid, description: "x".repeat(301) })), /300/);
  assert.match(String(validateDocumentLink({ ...valid, category: "x".repeat(41) })), /40/);
  assert.match(String(validateDocumentLink({ ...valid, url: `https://contoh.test/${"x".repeat(2040)}` })), /2048/);
});
