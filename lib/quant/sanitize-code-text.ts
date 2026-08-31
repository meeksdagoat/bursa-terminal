/** Strip accidental HTML from pasted or corrupted editor content. */
export function sanitizePlainCode(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}
