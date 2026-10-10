// PDF submissions are stored in the submission's content as base64, so they
// live in the database with everything else (no file storage to provision).

/** Upload cap. Base64 adds a third, and Vercel caps request bodies at 4.5 MB. */
export const MAX_PDF_BYTES = 3 * 1024 * 1024;

/** The PDF's bytes; throws unless `base64` decodes to a PDF within the cap. */
export function pdfBytes(base64: string): Buffer {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("That file isn't a PDF.");
  if (bytes.length > MAX_PDF_BYTES) throw new Error("PDFs can be up to 3 MB.");
  return bytes;
}
