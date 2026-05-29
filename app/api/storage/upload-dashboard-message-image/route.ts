import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = process.env.SUPABASE_RECEIPTS_BUCKET || "receipts";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // compressed client image should be <= 2MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getExt(file: File) {
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  return "jpg";
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, and WebP images are allowed" }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: "Image is too large after compression. Please choose a smaller image." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const ext = getExt(file);
    const key = `dashboard-messages/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to upload image" }, { status: 500 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);

    return NextResponse.json(
      {
        ok: true,
        image: {
          url: data.publicUrl,
          key,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload dashboard image" },
      {
        status:
          error?.message === "Unauthorized"
            ? 401
            : error?.message === "Forbidden"
              ? 403
              : 500,
      },
    );
  }
}
