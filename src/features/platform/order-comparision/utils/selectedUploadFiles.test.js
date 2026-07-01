import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatFileSize,
  getFailedUploadIds,
  MAX_PDF_SIZE_BYTES,
  mergeSelectedPdfFiles,
} from './selectedUploadFiles.js';

const pdf = (name, size, lastModified) => ({
  lastModified,
  name,
  size,
  type: 'application/pdf',
});

test('adds consecutive PDF selections without replacing existing files', () => {
  const firstSelection = [pdf('one.pdf', 100, 1)];
  const secondSelection = [pdf('two.pdf', 200, 2), pdf('three.pdf', 300, 3)];
  const thirdSelection = [pdf('four.pdf', 400, 4)];

  const afterSecondSelection = mergeSelectedPdfFiles(firstSelection, secondSelection);
  const afterThirdSelection = mergeSelectedPdfFiles(afterSecondSelection.files, thirdSelection);

  assert.deepEqual(
    afterThirdSelection.files.map((file) => file.name),
    ['one.pdf', 'two.pdf', 'three.pdf', 'four.pdf']
  );
});

test('ignores duplicate files and rejects non-PDF files', () => {
  const existingPdf = pdf('one.pdf', 100, 1);
  const result = mergeSelectedPdfFiles(
    [existingPdf],
    [existingPdf, { name: 'notes.txt', size: 50, lastModified: 2, type: 'text/plain' }]
  );

  assert.deepEqual(result.files, [existingPdf]);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.rejectedCount, 1);
});

test('rejects PDFs larger than 10 MB before they are queued', () => {
  const validPdf = pdf('valid.pdf', MAX_PDF_SIZE_BYTES, 1);
  const oversizedPdf = pdf('too-large.pdf', MAX_PDF_SIZE_BYTES + 1, 2);
  const result = mergeSelectedPdfFiles([], [validPdf, oversizedPdf]);

  assert.deepEqual(result.files, [validPdf]);
  assert.deepEqual(result.oversizedFiles, [oversizedPdf]);
});

test('formats the displayed file size', () => {
  assert.equal(formatFileSize(1536), '2 KB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
});

test('returns only failed uploads for retry', () => {
  const ids = getFailedUploadIds([
    { id: 'success', status: 'success' },
    { id: 'failed', status: 'error' },
    { id: 'canceled', status: 'canceled' },
  ]);

  assert.deepEqual(ids, ['failed']);
});
