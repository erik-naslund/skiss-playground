/**
 * Handing a file to the visitor, and text to their clipboard. Two calls the
 * browser already has, wrapped so the page's wiring reads as what it does and
 * so nothing here is a dependency (AGENTS.md §2).
 */

const NO_CLIPBOARD = 'this browser did not offer a clipboard to write to';

/**
 * A blob as a download, through a temporary `<a download>`: there is no server
 * to ask for the file, so the link points at a blob URL, is clicked and is
 * taken out again. The URL is revoked on the next turn of the event loop
 * rather than immediately — the click starts the download asynchronously, and
 * a URL revoked in the same turn is sometimes revoked before it is read.
 */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  // Firefox only follows a click on a link that is in the document.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Text to the clipboard. The API is missing in a browser too old for it and in
 * a page served over plain HTTP, and it rejects where the visitor has refused
 * the permission; all three reach the caller as an error, so the page can say
 * what happened rather than doing nothing visible.
 */
export async function copyText(text: string): Promise<void> {
  const clipboard: Clipboard | undefined = navigator.clipboard;
  if (clipboard === undefined) {
    throw new Error(NO_CLIPBOARD);
  }
  await clipboard.writeText(text);
}
