cat > convert-minsam-reject-to-pending-full.sh <<'EOF'
#!/bin/bash

echo "=================================================="
echo " Converting /minsam Change to Reject -> Return to Pending"
echo "=================================================="

BACKUP_DIR="backups-minsam-convert-pending-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

backup_file() {
  local file="$1"
  if [ -f "$file" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp "$file" "$BACKUP_DIR/$file.bak"
  fi
}

backup_file "app/(protected)/minsam/page.tsx"
backup_file "components/minsam/RejectApprovedModal.tsx"
backup_file "components/minsam/ReturnApprovedToPendingModal.tsx"
backup_file "lib/api/adminsam.ts"
backup_file "hooks/useAdminsam.ts"
backup_file "app/api/minsam/submissions/[id]/reject-approved/route.ts"
backup_file "app/api/minsam/submissions/[id]/return-pending/route.ts"

mkdir -p "components/minsam"
mkdir -p "app/api/minsam/submissions/[id]/return-pending"

echo "1. Creating clean ReturnApprovedToPendingModal..."

cat > "components/minsam/ReturnApprovedToPendingModal.tsx" <<'MODAL'
'use client';

import type { Lang } from '@/lib/i18n/translations';

type Props = {
  open: boolean;
  lang: Lang;
  isLoading: boolean;
  cancelLabel: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ReturnApprovedToPendingModal({
  open,
  lang,
  isLoading,
  cancelLabel,
  confirmLabel,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  const title =
    lang === 'am'
      ? 'ግቤቱን ወደ በመጠባበቅ መመለስ?'
      : 'Return Submission to Pending?';

  const message =
    lang === 'am'
      ? 'ይህን ግቤት ወደ በመጠባበቅ ሁኔታ መመለስ ይፈልጋሉ?'
      : 'Are you sure you want to return this submission to pending review?';

  const warning =
    lang === 'am'
      ? 'ይህ እርምጃ ቁጥሩን ነፃ አያደርገውም። ቁጥሩ በቢጫ የበመጠባበቅ ሁኔታ ይቆያል።'
      : 'This action will not release the number. It will stay pending/yellow for further review.';

  const loadingText = lang === 'am' ? 'በመመለስ ላይ...' : 'Returning...';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>

        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>

        <div className="mt-5 rounded-xl border border-yellow-100 bg-yellow-50 p-3 text-sm text-yellow-800">
          {warning}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            {isLoading ? loadingText : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
MODAL

echo "2. Creating backend route approved/rejected -> pending..."

cat > "app/api/minsam/submissions/[id]/return-pending/route.ts" <<'ROUTE'
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/sql';
import { requireAdmin } from '@/lib/auth/server';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin(req);
    const id = params.id;

    const target = await sql`
      SELECT id, submission_group_id, status
      FROM submissions
      WHERE id::text = ${id}
         OR submission_group_id::text = ${id}
      LIMIT 1
    `;

    if (!target.length) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    const sub = target[0];

    if (!['approved', 'rejected'].includes(sub.status)) {
      return NextResponse.json(
        { error: 'Only approved or rejected submissions can be returned to pending.' },
        { status: 400 }
      );
    }

    const targetRows = await sql`
      SELECT id, number
      FROM submissions
      WHERE
        id = ${sub.id}
        OR (
          ${sub.submission_group_id}::uuid IS NOT NULL
          AND submission_group_id = ${sub.submission_group_id}
        )
    `;

    const numbers = targetRows
      .map((row: any) => Number(row.number))
      .filter((num: number) => Number.isFinite(num));

    if (!numbers.length) {
      return NextResponse.json(
        { error: 'No numbers found for this submission.' },
        { status: 400 }
      );
    }

    /*
      Safety check:
      rejected -> pending can only happen if the number is not already
      pending or approved by another submission.
    */
    const conflicts = await sql`
      SELECT id, number, status
      FROM submissions
      WHERE number = ANY(${numbers}::int[])
        AND status IN ('pending', 'approved')
        AND NOT (
          id = ${sub.id}
          OR (
            ${sub.submission_group_id}::uuid IS NOT NULL
            AND submission_group_id = ${sub.submission_group_id}
          )
        )
      LIMIT 10
    `;

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: 'This number is already pending or approved by another submission.',
          conflicts,
        },
        { status: 409 }
      );
    }

    const updated = await sql`
      UPDATE submissions
      SET
        status = 'pending',
        approved_at = NULL,
        rejected_at = NULL
      WHERE
        (
          id = ${sub.id}
          OR (
            ${sub.submission_group_id}::uuid IS NOT NULL
            AND submission_group_id = ${sub.submission_group_id}
          )
        )
        AND status IN ('approved', 'rejected')
      RETURNING id, number, status, approved_at, rejected_at
    `;

    /*
      Do NOT delete number_locks here.
      Pending numbers must stay unavailable/yellow.
    */

    try {
      await sql`
        INSERT INTO audit_logs(admin_id, action, details)
        VALUES (
          ${admin.userId || admin.id || null},
          'minsam_returned_to_pending',
          ${JSON.stringify({
            submissionId: id,
            previousStatus: sub.status,
            numbers,
            changedBy: admin.userId || admin.id || null,
            changedAt: new Date().toISOString(),
          })}
        )
      `;
    } catch (auditError) {
      console.warn('Minsam return-pending audit log skipped:', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Submission returned to pending.',
      previousStatus: sub.status,
      numbers,
      submissions: updated,
    });
  } catch (error: any) {
    console.error('Minsam return-pending error:', error);

    return NextResponse.json(
      {
        error:
          error.message || 'Failed to return submission to pending',
      },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
            ? 403
            : 500,
      }
    );
  }
}
ROUTE

echo "3. Updating lib/api/adminsam.ts..."

python3 <<'PY'
from pathlib import Path
import re

file_path = Path("lib/api/adminsam.ts")

if not file_path.exists():
    raise SystemExit("lib/api/adminsam.ts not found")

content = file_path.read_text()

# Remove old reject-approved function
content = re.sub(
    r"\nexport async function rejectApprovedSubmission\(id: string\) \{[\s\S]*?\n\}",
    "",
    content,
    count=1
)

# Add return-to-pending function
if "returnApprovedToPendingSubmission" not in content:
    content += """

export async function returnApprovedToPendingSubmission(id: string) {
  const res = await apiFetch(
    `/api/minsam/submissions/${id}/return-pending?t=${Date.now()}`,
    {
      method: 'PATCH',
    }
  );

  return readJson(res);
}
"""

file_path.write_text(content)
print("lib/api/adminsam.ts updated.")
PY

echo "4. Updating hooks/useAdminsam.ts..."

python3 <<'PY'
from pathlib import Path
import re

file_path = Path("hooks/useAdminsam.ts")

if not file_path.exists():
    raise SystemExit("hooks/useAdminsam.ts not found")

content = file_path.read_text()

# Remove old import references
content = content.replace("rejectApprovedSubmission,", "")
content = content.replace("  rejectApprovedSubmission,\n", "")

# Ensure new API import exists
if "returnApprovedToPendingSubmission" not in content:
    content = content.replace(
        "} from '@/lib/api/adminsam';",
        "  returnApprovedToPendingSubmission,\n} from '@/lib/api/adminsam';"
    )

# Remove old hook
content = re.sub(
    r"\nexport const useMinsamRejectApprovedSubmission = \(\) => \{[\s\S]*?\n\};",
    "",
    content,
    count=1
)

# Add new hook
if "useMinsamReturnApprovedToPendingSubmission" not in content:
    content += """

export const useMinsamReturnApprovedToPendingSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: returnApprovedToPendingSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minsam', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['minsam', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['numbers'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'submissions'] });
    },
  });
};
"""

file_path.write_text(content)
print("hooks/useAdminsam.ts updated.")
PY

echo "5. Updating app/(protected)/minsam/page.tsx..."

python3 <<'PY'
from pathlib import Path
import re

file_path = Path("app/(protected)/minsam/page.tsx")

if not file_path.exists():
    raise SystemExit("app/(protected)/minsam/page.tsx not found")

content = file_path.read_text()

# Replace modal import
content = content.replace(
    "import RejectApprovedModal from '@/components/minsam/RejectApprovedModal';",
    "import ReturnApprovedToPendingModal from '@/components/minsam/ReturnApprovedToPendingModal';"
)

if "ReturnApprovedToPendingModal" not in content:
    content = content.replace(
        "import AdminSettingsPanel from '@/components/AdminSettingsPanel';",
        "import AdminSettingsPanel from '@/components/AdminSettingsPanel';\nimport ReturnApprovedToPendingModal from '@/components/minsam/ReturnApprovedToPendingModal';"
    )

# Replace hook import
content = content.replace(
    "useMinsamRejectApprovedSubmission,",
    "useMinsamReturnApprovedToPendingSubmission,"
)

if "useMinsamReturnApprovedToPendingSubmission" not in content:
    content = content.replace(
        "useMinsamClearAllSubmissions,",
        "useMinsamClearAllSubmissions,\n  useMinsamReturnApprovedToPendingSubmission,"
    )

# Rename state variables
content = content.replace("rejectApprovedModalId", "returnPendingModalId")
content = content.replace("setRejectApprovedModalId", "setReturnPendingModalId")

# Replace mutation
content = content.replace(
    "const { mutate: rejectApproved } = useMinsamRejectApprovedSubmission();",
    "const { mutate: returnToPending } = useMinsamReturnApprovedToPendingSubmission();"
)

if "const { mutate: returnToPending } = useMinsamReturnApprovedToPendingSubmission();" not in content:
    content = content.replace(
        "const { mutate: reject } = useMinsamRejectSubmission();",
        "const { mutate: reject } = useMinsamRejectSubmission();\n  const { mutate: returnToPending } = useMinsamReturnApprovedToPendingSubmission();"
    )

# Processing type
content = content.replace("'reject-approved'", "'return-pending'")
content = content.replace('"reject-approved"', '"return-pending"')

# Label variable replacements
content = content.replace("changeToRejectLabel", "returnToPendingLabel")
content = content.replace("rejectApprovedSuccess", "returnToPendingSuccess")
content = content.replace("rejectApprovedFailed", "returnToPendingFailed")

# Text replacements
content = content.replace("'ወደ ውድቅ ቀይር'", "'ወደ በመጠባበቅ መልስ'")
content = content.replace("'Change to Reject'", "'Return to Pending'")

content = content.replace(
    "'የጸደቀው ግቤት ወደ ውድቅ ተቀይሯል።'",
    "'ግቤቱ ወደ በመጠባበቅ ተመልሷል።'"
)

content = content.replace(
    "'Approved submission changed to rejected.'",
    "'Submission returned to pending.'"
)

content = content.replace(
    "'የጸደቀውን ግቤት ወደ ውድቅ መቀየር አልተሳካም።'",
    "'ግቤቱን ወደ በመጠባበቅ መመለስ አልተሳካም።'"
)

content = content.replace(
    "'Failed to change approved submission to rejected.'",
    "'Failed to return submission to pending.'"
)

# Rename handler functions
content = content.replace("handleRejectApproved", "handleReturnToPending")
content = content.replace("confirmRejectApproved", "confirmReturnToPending")
content = content.replace("closeRejectApprovedModal", "closeReturnPendingModal")

# Replace mutation call
content = content.replace("rejectApproved(id,", "returnToPending(id,")

# Replace modal component
content = content.replace("RejectApprovedModal", "ReturnApprovedToPendingModal")

# Replace approved-only action condition with approved or rejected
content = content.replace(
    "sub.status === 'approved' ? (",
    "['approved', 'rejected'].includes(sub.status) ? ("
)
content = content.replace(
    'sub.status === "approved" ? (',
    '["approved", "rejected"].includes(sub.status) ? ('
)

# Button style from red to yellow
content = content.replace(
    'className="rounded border border-red-300 px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"',
    'className="rounded border border-yellow-300 px-3 py-1 text-sm font-semibold text-yellow-700 hover:bg-yellow-50 disabled:opacity-50"'
)

# Loading label
content = content.replace(
    "(lang === 'am' ? 'በመቀየር ላይ...' : 'Changing...') : returnToPendingLabel",
    "(lang === 'am' ? 'በመመለስ ላይ...' : 'Returning...') : returnToPendingLabel"
)

# Error handler: translate conflict message
content = re.sub(
    r"onError:\s*\(err:\s*any\)\s*=>\s*\{\s*const message\s*=\s*err\.message === 'This number is already pending or approved by another submission\.'[\s\S]*?toast\.error\(message\);\s*\}",
    """onError: (err: any) => {
        const message =
          err.message === 'This number is already pending or approved by another submission.'
            ? txt.numberAlreadyActive
            : err.message || returnToPendingFailed;

        toast.error(message);
      }""",
    content,
    count=1
)

# If still simple old error handler exists, replace it
content = re.sub(
    r"onError:\s*\(err:\s*any\)\s*=>\s*toast\.error\(\s*err\.message\s*\|\|\s*returnToPendingFailed\s*\)",
    """onError: (err: any) => {
        const message =
          err.message === 'This number is already pending or approved by another submission.'
            ? txt.numberAlreadyActive
            : err.message || returnToPendingFailed;

        toast.error(message);
      }""",
    content,
    count=1
)

file_path.write_text(content)
print("/minsam/page.tsx updated.")
PY

echo "6. Optional cleanup: removing old reject-approved route/component if you want"

# Keep old files as harmless backups in the codebase? We won't delete automatically.
# They are no longer used after imports/routes move to return-pending.

echo ""
echo "=================================================="
echo " Done"
echo "=================================================="
echo "Backup saved in: $BACKUP_DIR"
echo ""
echo "Updated behavior:"
echo "Pending  -> Approve / Reject"
echo "Approved -> Return to Pending"
echo "Rejected -> Return to Pending"
echo ""
echo "Now run:"
echo "npm run build"
EOF

chmod +x convert-minsam-reject-to-pending-full.sh
./convert-minsam-reject-to-pending-full.sh