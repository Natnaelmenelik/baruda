#!/usr/bin/env bash
set -euo pipefail

FILE="app/api/admin/clear-all/route.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ Cannot find $FILE. Run this script from your project root."
  exit 1
fi

cp "$FILE" "$FILE.bak.$(date +%Y%m%d%H%M%S)"

python3 - <<'PY'
from pathlib import Path
import re

path = Path("app/api/admin/clear-all/route.ts")
text = path.read_text()

# Ensure StorageCleanupResult can report preserved files without TypeScript errors.
text = re.sub(
    r"type StorageCleanupResult = \{([\s\S]*?)  attemptedKeys: string\[\];\n\};",
    lambda m: "type StorageCleanupResult = {" + m.group(1) + "  attemptedKeys: string[];\n  preservedKeys: string[];\n};",
    text,
    count=1,
)

# Add preserved dashboard folder constants after RECEIPTS_BUCKET.
if "DASHBOARD_MESSAGES_STORAGE_FOLDER" not in text:
    marker = '''const RECEIPTS_BUCKET =
  process.env.SUPABASE_RECEIPTS_BUCKET ||
  process.env.RECEIPTS_BUCKET ||
  "receipts";
'''
    replacement = marker + '''
// Dashboard message images are stored inside the receipts bucket under this folder.
// Clear & Start New Round must delete receipt files, but must NEVER delete this folder.
const DASHBOARD_MESSAGES_STORAGE_FOLDER = "dashboard-messages";
'''
    if marker not in text:
        raise SystemExit("Could not find RECEIPTS_BUCKET block to patch")
    text = text.replace(marker, replacement, 1)

# Remove older partial preserved-prefix constants if they exist, to avoid confusion.
text = re.sub(
    r'\n// Dashboard message images are intentionally stored[\s\S]*?const PRESERVED_STORAGE_PREFIXES = \["dashboard-messages/"\];\n',
    '\n',
    text,
    count=1,
)

# Add/replace helper after fallbackKeyFromUrl.
helper = '''function fallbackKeyFromUrl(url: string | null | undefined) {
  return normalizeReceiptKey(String(url || ""));
}

function shouldPreserveStorageKey(rawKey: string) {
  const key = normalizeReceiptKey(rawKey).replace(/^\\/+/, "");

  return (
    key === DASHBOARD_MESSAGES_STORAGE_FOLDER ||
    key.startsWith(`${DASHBOARD_MESSAGES_STORAGE_FOLDER}/`)
  );
}
'''
text = re.sub(
    r'function fallbackKeyFromUrl\(url: string \| null \| undefined\) \{[\s\S]*?\}\n\n(?:function shouldPreserveStorageKey\([\s\S]*?\}\n\n)?',
    helper + '\n',
    text,
    count=1,
)

# Make recursive listing skip the protected folder completely.
list_start = text.find('async function listAllStorageFiles(')
list_end = text.find('\nasync function removeStorageFilesInBatches', list_start)
if list_start == -1 or list_end == -1:
    raise SystemExit("Could not find listAllStorageFiles block")
list_func = '''async function listAllStorageFiles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  prefix = "",
): Promise<string[]> {
  // If the recursive scanner reaches the dashboard message folder, stop.
  // This prevents even accidental deletion of dashboard message assets.
  if (prefix && shouldPreserveStorageKey(prefix)) {
    return [];
  }

  const allFiles: string[] = [];

  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) {
    throw new Error(error.message || `Failed to list bucket ${bucket}`);
  }

  for (const item of data || []) {
    const name = item.name;
    const fullPath = prefix ? `${prefix}/${name}` : name;

    // Protect both the folder placeholder and any nested image path.
    if (shouldPreserveStorageKey(fullPath)) {
      continue;
    }

    /*
      Supabase Storage list items may represent folders with id = null.
      Files normally have id / metadata.
    */
    const isFolder =
      !item.id &&
      !item.updated_at &&
      (!item.metadata || Object.keys(item.metadata || {}).length === 0);

    if (isFolder) {
      const nested = await listAllStorageFiles(supabase, bucket, fullPath);
      allFiles.push(...nested);
    } else {
      allFiles.push(fullPath);
    }
  }

  return allFiles;
}
'''
text = text[:list_start] + list_func + text[list_end:]

# Make batch removal defensively skip protected keys too.
text = re.sub(
    r'''  const uniqueKeys = Array\.from\(\n    new Set\(keys\.map\(normalizeReceiptKey\)\.filter\(Boolean\)\),\n  \);''',
    '''  const uniqueKeys = Array.from(
    new Set(
      keys
        .map(normalizeReceiptKey)
        .filter(Boolean)
        .filter((key) => !shouldPreserveStorageKey(key)),
    ),
  );''',
    text,
    count=1,
)

# Rewrite deleteReceiptStorageFiles fully, so it never sends dashboard-messages paths to remove().
start = text.find('async function deleteReceiptStorageFiles(')
end = text.find('\nexport async function POST', start)
if start == -1 or end == -1:
    raise SystemExit("Could not find deleteReceiptStorageFiles block")
new_delete = '''async function deleteReceiptStorageFiles(
  dbReceiptKeys: string[],
): Promise<StorageCleanupResult> {
  const supabase = createSupabaseAdminClient();

  const dbKeys = uniqueCleanKeys(dbReceiptKeys);
  let listedFiles: string[] = [];
  const errors: string[] = [];

  try {
    /*
      Comprehensive cleanup:
      1. delete DB-known receipt keys
      2. list the receipts bucket recursively
      3. delete receipt files only

      IMPORTANT:
      dashboard-messages/* is protected because dashboard message images are
      intentionally stored inside the same receipts bucket.
    */
    listedFiles = await listAllStorageFiles(supabase, RECEIPTS_BUCKET);
  } catch (error: any) {
    const message = error?.message || "Failed to list receipts bucket";
    console.warn("Receipt bucket list failed:", message);
    errors.push(message);
  }

  const rawKeys = Array.from(
    new Set(
      [...dbKeys, ...listedFiles].map(normalizeReceiptKey).filter(Boolean),
    ),
  );

  const preservedKeys = rawKeys.filter(shouldPreserveStorageKey);
  const allKeys = rawKeys.filter((key) => !shouldPreserveStorageKey(key));

  console.log("Deleting receipt files:", {
    bucket: RECEIPTS_BUCKET,
    dbKeysFound: dbKeys.length,
    listedFilesFound: listedFiles.length,
    protectedFolder: `${DASHBOARD_MESSAGES_STORAGE_FOLDER}/`,
    preserved: preservedKeys.length,
    attempted: allKeys.length,
    keys: allKeys,
  });

  const removeResult = await removeStorageFilesInBatches(
    supabase,
    RECEIPTS_BUCKET,
    allKeys,
  );

  console.log("Receipt delete result:", {
    ...removeResult,
    preservedKeys,
  });

  return {
    bucket: RECEIPTS_BUCKET,
    dbKeysFound: dbKeys.length,
    listedFilesFound: listedFiles.length,
    attempted: removeResult.attempted,
    deleted: removeResult.deleted,
    failed: removeResult.failed,
    errors: [...errors, ...removeResult.errors],
    attemptedKeys: removeResult.attemptedKeys,
    preservedKeys,
  };
}
'''
text = text[:start] + new_delete + text[end:]

path.write_text(text)
PY

echo "✅ Patched $FILE"
echo "✅ Clear & Start New Round will now protect: receipts/dashboard-messages/*"
echo "✅ This version protects both 'dashboard-messages' folder placeholder and 'dashboard-messages/...' files."
echo ""
echo "Next steps:"
echo "  npm run build"
echo "  deploy"
echo "  upload a dashboard message image"
echo "  click Clear & Start New Round"
echo "  verify the image still exists in Supabase Storage"
