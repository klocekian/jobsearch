// Unified text extraction for uploaded files: PDF, DOCX, and plain text / Markdown.
// Runs entirely in the browser (files never leave the device). DOCX is read with
// a dependency-free ZIP reader + the platform DecompressionStream, so no new
// package is required.

import { extractPdfText } from "./pdf";

export interface ExtractedFile {
  text: string;
  /** Page count for PDFs; undefined for other formats. */
  pages?: number;
}

const PDF_RE = /\.pdf$/i;
const DOCX_RE = /\.docx$/i;
const TEXT_RE = /\.(txt|md|markdown|text)$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isSupportedFile(file: File): boolean {
  return (
    PDF_RE.test(file.name) ||
    DOCX_RE.test(file.name) ||
    TEXT_RE.test(file.name) ||
    file.type === "application/pdf" ||
    file.type === DOCX_MIME ||
    file.type.startsWith("text/")
  );
}

/** Human-readable list of accepted formats, for prompts and error messages. */
export const SUPPORTED_FORMATS = "PDF, DOCX, .txt, or .md";

export async function extractFileText(file: File): Promise<ExtractedFile> {
  if (PDF_RE.test(file.name) || file.type === "application/pdf") {
    return extractPdfText(file);
  }
  if (DOCX_RE.test(file.name) || file.type === DOCX_MIME) {
    return { text: await extractDocxText(file) };
  }
  if (TEXT_RE.test(file.name) || file.type.startsWith("text/")) {
    return { text: (await file.text()).trim() };
  }
  throw new Error(`Unsupported file type. Upload a ${SUPPORTED_FORMATS} file.`);
}

// --- DOCX (a ZIP of XML; we read word/document.xml and strip the markup) ---

async function extractDocxText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const xml = await readZipEntry(buf, "word/document.xml");
  if (xml == null) throw new Error("Couldn't read this .docx — it may be corrupt. Paste the text instead.");
  const text = docxXmlToText(xml);
  if (!text.trim()) throw new Error("No text found in this .docx. Paste the text instead.");
  return text;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // .slice() yields an ArrayBuffer-backed copy (a valid BlobPart under strict TS).
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read a single entry from a ZIP via its central directory. Returns its text. */
async function readZipEntry(buf: Uint8Array, name: string): Promise<string | null> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Locate the End Of Central Directory record (scan back from the end).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x0605_4b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true); // central directory offset
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x0201_4b50) break; // central dir header sig
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const entryName = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    if (entryName === name) {
      // Local file header: name length at +26, extra length at +28, then data.
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      const bytes = method === 0 ? data : await inflateRaw(data);
      return new TextDecoder().decode(bytes);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** Convert WordprocessingML to readable plain text. */
function docxXmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
