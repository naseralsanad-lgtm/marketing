import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_TEXT_CHARS = 200_000;
const EXT = ["pdf", "docx", "pptx", "txt", "md", "csv"];
export class DocError extends Error { constructor(message: string, public status = 400) { super(message); } }

const clean = (s: string) => s.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_CHARS);
const xmlText = (xml: string) => xml.replace(/<a:br\s*\/>/g, "\n").replace(/<\/a:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Validate and extract plain text from an uploaded file. Content is treated purely as data. */
export async function parseFile(name: string, buf: Buffer): Promise<string> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (!EXT.includes(ext)) throw new DocError(`Unsupported file type “.${ext}”. Upload PDF, Word (.docx), PowerPoint (.pptx) or text files.`);
  if (buf.length > MAX_FILE_BYTES) throw new DocError("File is larger than 15 MB.", 413);
  if (!buf.length) throw new DocError("The file is empty.");
  const magic = buf.subarray(0, 4).toString("latin1");
  if (ext === "pdf") {
    if (!magic.startsWith("%PDF")) throw new DocError("This file is not a valid PDF.");
    const { extractText, getDocumentProxy } = await import("unpdf");
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(buf)), { mergePages: true });
    const out = clean(text);
    if (!out) throw new DocError("No selectable text found in this PDF (it may be a scan). Paste the text instead.", 422);
    return out;
  }
  if (ext === "docx" || ext === "pptx") {
    if (!magic.startsWith("PK")) throw new DocError(`This file is not a valid .${ext} document.`);
    if (ext === "docx") { const mammoth = await import("mammoth"); return clean((await mammoth.extractRawText({ buffer: buf })).value); }
    const JSZip = (await import("jszip")).default; const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    if (slides.length > 300) throw new DocError("Presentation has too many slides.");
    const parts: string[] = [];
    for (const f of slides) parts.push(xmlText(await zip.files[f].async("string")));
    return clean(parts.join("\n\n"));
  }
  if (buf.subarray(0, 2000).includes(0)) throw new DocError("This does not look like a text file.");
  return clean(buf.toString("utf8"));
}

function isPrivate(ip: string): boolean {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:") && isPrivate(l.slice(7)); }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Fetch a public web page as text. Blocks non-HTTP(S), private/loopback addresses and oversized bodies. */
export async function fetchUrlText(raw: string): Promise<{ name: string; text: string }> {
  let url: URL; try { url = new URL(raw); } catch { throw new DocError("Enter a valid URL."); }
  for (let hop = 0; hop < 4; hop++) {
    if (!/^https?:$/.test(url.protocol)) throw new DocError("Only http(s) URLs are supported.");
    const addrs = await lookup(url.hostname, { all: true }).catch(() => { throw new DocError("Could not resolve that address.", 422); });
    if (addrs.some((a) => isPrivate(a.address))) throw new DocError("That address is not publicly reachable.");
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "MarketingPlanner/1.0 (document import)", Accept: "text/html,text/plain" } }).catch(() => { throw new DocError("Could not fetch that page.", 502); });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { url = new URL(res.headers.get("location")!, url); continue; }
    if (!res.ok) throw new DocError(`The page returned HTTP ${res.status}.`, 502);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/|application\/xhtml/.test(type)) throw new DocError("That URL is not a web page or text document. Upload the file instead.");
    const reader = res.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (reader) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 3_000_000) { await reader.cancel(); break; } chunks.push(value); }
    const html = Buffer.concat(chunks).toString("utf8");
    const title = html.match(/<title[^>]*>([^<]{1,200})/i)?.[1]?.trim();
    const text = html.replace(/<(script|style|noscript|svg|head|nav|footer)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|div|li|h[1-6]|tr|section|article)>|<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "- ").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]{2,}/g, " ").replace(/\n[ \t]+/g, "\n");
    const out = clean(text);
    if (out.length < 40) throw new DocError("No readable text found on that page.", 422);
    return { name: title || url.hostname, text: out };
  }
  throw new DocError("Too many redirects.");
}
