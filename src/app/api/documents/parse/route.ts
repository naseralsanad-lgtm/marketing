import { NextResponse } from "next/server";
import { DocError, fetchUrlText, MAX_FILE_BYTES, parseFile } from "@/server/documents";
import { fail, guard } from "@/server/guard";

export async function POST(req: Request) {
  const blocked = await guard(req, 20); if (blocked) return blocked;
  try {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const { url } = (await req.json()) as { url?: string };
      if (!url || url.length > 2000) return fail("Enter a valid URL.", 400);
      return NextResponse.json({ ...(await fetchUrlText(url)), kind: "url" });
    }
    if (Number(req.headers.get("content-length") ?? 0) > MAX_FILE_BYTES + 100_000) return fail("File is larger than 15 MB.", 413);
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return fail("No file received.", 400);
    const text = await parseFile(file.name, Buffer.from(await file.arrayBuffer()));
    if (!text) return fail("No text could be extracted from this file.", 422);
    return NextResponse.json({ name: file.name.slice(0, 200), text, kind: "file" });
  } catch (e) {
    return e instanceof DocError ? fail(e.message, e.status) : fail("This document could not be read. It may be corrupted or password-protected.", 422);
  }
}
