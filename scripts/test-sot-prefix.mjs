import test from "node:test";
import assert from "node:assert/strict";
import { cleanPrefixes, extractPrefixes, collectPrefixes } from "../lib/sot-prefix.ts";

test("cleanPrefixes: aturan satu per satu", () => {
  assert.deepEqual(cleanPrefixes("Linus2-FAL"), ["Linus"]);          // "-" lalu angka
  assert.deepEqual(cleanPrefixes("Carrey-FB EHC"), ["Carrey"]);      // hanya bagian sebelum "-"
  assert.deepEqual(cleanPrefixes("Lucida2"), ["Lucida"]);            // angka
  assert.deepEqual(cleanPrefixes("Sparrow_Lite2"), ["Sparrow"]);     // angka lalu "_"
  assert.deepEqual(cleanPrefixes("Foo(bar)"), ["Foo"]);              // "("
  assert.deepEqual(cleanPrefixes("Nifty"), ["Nifty"]);               // tidak berubah
  assert.deepEqual(cleanPrefixes("AirPrint/Mopria"), ["AirPrint", "Mopria"]); // "/" jadi 2
  assert.deepEqual(cleanPrefixes("A/BC"), ["BC"]);                   // 1 karakter dibuang
});

test("cleanPrefixes: kasus pinggir", () => {
  assert.deepEqual(cleanPrefixes(""), []);
  assert.deepEqual(cleanPrefixes("   "), []);
  assert.deepEqual(cleanPrefixes("X1"), []);        // jadi "X" (1 karakter) lalu dibuang
  assert.deepEqual(cleanPrefixes("123"), []);       // semua angka
  assert.deepEqual(cleanPrefixes("-FAL"), []);      // kosong sebelum "-"
  assert.deepEqual(cleanPrefixes("AB-CD/EF"), ["AB"]); // "/" setelah "-" tidak ikut
});

test("extractPrefixes: pecah koma dan hitung skipped", () => {
  const r = extractPrefixes("Linus2-FAL, Nifty, X1, ,Lucida2");
  assert.deepEqual(r.prefixes, ["Linus", "Nifty", "Lucida"]);
  assert.equal(r.skipped, 1); // "X1"
});

test("collectPrefixes: tanpa duplikat, huruf besar-kecil diabaikan", () => {
  const r = collectPrefixes(["Linus2-FAL", "linus3", "Nifty", "X1"]);
  assert.deepEqual(r.prefixes, ["Linus", "Nifty"]); // "linus" dianggap sama dengan "Linus"
  assert.equal(r.skipped, 1);
});
