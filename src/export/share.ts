/** Downloads a file via <a download>; opens a new tab if the browser does not support it. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  if (!('download' in a)) window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canShareFile(blob: Blob, filename: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  return navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] });
}

/** Opens the OS share sheet (iPad/iPhone: save to Files, Photos, AirDrop). */
export async function shareBlob(blob: Blob, filename: string): Promise<void> {
  try {
    await navigator.share({ files: [new File([blob], filename, { type: blob.type })] });
  } catch (e) {
    if ((e as DOMException).name !== 'AbortError') throw e;
  }
}
