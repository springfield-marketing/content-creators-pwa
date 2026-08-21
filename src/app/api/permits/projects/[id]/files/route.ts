// GET /api/permits/projects/[id]/files — QR images on a project's current
// permit, fetched when the dialog opens rather than shipped with the 396-row
// list.
//
// The capability check lives here rather than in the UI: blob urls are public,
// so hiding a button is not a restriction. Someone without viewQr calling this
// directly gets nothing.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { can } from "@/lib/registry/access";
import { getQrFiles } from "@/lib/registry/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return jsonError(401, "Not authenticated");
  if (!can(session.user.roles, "viewQr")) return jsonError(403, "Forbidden");

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return jsonError(400, "Invalid project id");
  }

  return NextResponse.json(await getQrFiles(projectId));
}
