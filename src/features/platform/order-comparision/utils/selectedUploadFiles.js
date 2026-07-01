export const isPdfFile = (file) => (
  file?.type === 'application/pdf' ||
  String(file?.name || '').toLowerCase().endsWith('.pdf')
);

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export const getFileIdentity = (file) => (
  `${file?.name || ''}:${file?.size || 0}:${file?.lastModified || 0}`
);

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const getFailedUploadIds = (results) => (
  Array.from(results || [])
    .filter((result) => result.status === 'error')
    .map((result) => result.id)
);

export function mergeSelectedPdfFiles(currentFiles, nextFiles, maxSize = MAX_PDF_SIZE_BYTES) {
  const files = Array.from(currentFiles || []);
  const identities = new Set(files.map(getFileIdentity));
  let duplicateCount = 0;
  let rejectedCount = 0;
  const oversizedFiles = [];

  Array.from(nextFiles || []).forEach((file) => {
    if (!isPdfFile(file)) {
      rejectedCount += 1;
      return;
    }

    if (Number(file.size) > maxSize) {
      oversizedFiles.push(file);
      return;
    }

    const identity = getFileIdentity(file);
    if (identities.has(identity)) {
      duplicateCount += 1;
      return;
    }

    identities.add(identity);
    files.push(file);
  });

  return { duplicateCount, files, oversizedFiles, rejectedCount };
}
