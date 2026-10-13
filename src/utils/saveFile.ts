// Hands a downloaded file to the browser to save, under the name the service gave it. The object
// URL is released a little later, not at once: some browsers cancel a download whose URL is
// revoked while it is still starting.
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
