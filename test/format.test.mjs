import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeHttpUrl, formatCount, formatSizeKb, escapeCsv, toCsv, formatDuration } from '../public/lib/format.js';

test('escapeHtml escapes all HTML-significant characters', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('safeHttpUrl only allows http and https', () => {
  assert.equal(safeHttpUrl('https://github.com/x'), 'https://github.com/x');
  assert.equal(safeHttpUrl('http://example.com'), 'http://example.com/');
  assert.equal(safeHttpUrl('javascript:alert(1)'), '#');
  assert.equal(safeHttpUrl('JaVaScRiPt:alert(1)'), '#');
  assert.equal(safeHttpUrl('data:text/html,<script>'), '#');
  assert.equal(safeHttpUrl('not a url'), '#');
  assert.equal(safeHttpUrl(''), '#');
});

test('formatCount handles nulls, junk, and abbreviations', () => {
  assert.equal(formatCount(null), '-');
  assert.equal(formatCount('<script>'), '-');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1500), '1.5k');
  assert.equal(formatCount(2_500_000), '2.5M');
});

test('formatSizeKb', () => {
  assert.equal(formatSizeKb(0), '0 KB');
  assert.equal(formatSizeKb(512), '512 KB');
  assert.equal(formatSizeKb(2048), '2.0 MB');
  assert.equal(formatSizeKb(3 * 1024 * 1024), '3.00 GB');
});

test('formatDuration', () => {
  assert.equal(formatDuration(1200), '2s');
  assert.equal(formatDuration(60_000), '1m');
  assert.equal(formatDuration(95_000), '1m 35s');
});

test('escapeCsv quotes and neutralizes formula injection', () => {
  assert.equal(escapeCsv('plain'), 'plain');
  assert.equal(escapeCsv('a,b'), '"a,b"');
  assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsv('line1\nline2'), 'line1 line2');
  assert.equal(escapeCsv('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(escapeCsv('+1'), "'+1");
  assert.equal(escapeCsv('@cmd'), "'@cmd");
  assert.equal(escapeCsv(42), '42');
});

test('toCsv joins header and rows', () => {
  assert.equal(toCsv(['a', 'b'], [[1, 'x,y']]), 'a,b\n1,"x,y"');
});
