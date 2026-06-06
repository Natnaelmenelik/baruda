#!/usr/bin/env bash
set -euo pipefail

FILE="components/SubmitNumberModal.tsx"

if [ ! -f "package.json" ]; then
  echo "❌ Run this script from the project root folder where package.json exists."
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "❌ Cannot find $FILE"
  exit 1
fi

BACKUP_DIR=".patch-backups/reservation-success-must-open-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$FILE" "$BACKUP_DIR/SubmitNumberModal.tsx.bak"

echo "✅ Backup created: $BACKUP_DIR/SubmitNumberModal.tsx.bak"

python3 - <<'PY'
from pathlib import Path

path = Path("components/SubmitNumberModal.tsx")
text = path.read_text()

helper = r'''
function normalizeReservationHoldResponse(
  data: any,
  fallbackClientHoldKey: string,
  numbers: number[],
  numberAmounts: Record<string, number>,
  totalAmount: number,
) {
  if (!data || typeof data !== "object") return null;

  const id = data.id ?? data.hold_id ?? data.holdId;
  const clientHoldKey =
    data.client_hold_key ?? data.clientHoldKey ?? data.client_hold ?? fallbackClientHoldKey;
  const expiresAt = data.expires_at ?? data.expiresAt ?? data.expiry ?? data.expired_at;

  if (!id || !clientHoldKey || !expiresAt) return null;

  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;

  return {
    ...data,
    id,
    client_hold_key: clientHoldKey,
    clientHoldKey,
    expires_at: expiresAt,
    expiresAt,
    numbers: Array.isArray(data.numbers) && data.numbers.length ? data.numbers : numbers,
    number_amounts: data.number_amounts ?? data.numberAmounts ?? numberAmounts,
    numberAmounts: data.numberAmounts ?? data.number_amounts ?? numberAmounts,
    total_amount: data.total_amount ?? data.totalAmount ?? totalAmount,
    totalAmount: data.totalAmount ?? data.total_amount ?? totalAmount,
  };
}
'''

if "function normalizeReservationHoldResponse(" not in text:
    marker = "function makeAmountMapForNumbers("
    idx = text.find(marker)
    if idx == -1:
        raise SystemExit("Could not find insertion point for normalizeReservationHoldResponse helper.")
    text = text[:idx] + helper + "\n" + text[idx:]

start = text.find("  useEffect(() => {\n    let cancelled = false;")
if start == -1:
    start = text.find("  useEffect(() => {\r\n    let cancelled = false;")
if start == -1:
    raise SystemExit("Could not find the fragile reservation useEffect block with cancelled flag.")

# Find the matching end of this useEffect call by locating the dependency array after the block.
needle = "  }, [\n    effectiveOpen,\n    activeClientHoldKey,\n    activeNumbersKey,\n    holdAmountMapKey,\n    totalAmount,\n    lang,\n    onClose,\n    reservationHold?.id,\n    reservationHold?.expires_at,\n  ]);"
end = text.find(needle, start)
if end == -1:
    raise SystemExit("Could not find the end dependency array of the reservation useEffect block.")
end += len(needle)

replacement = r'''  useEffect(() => {
    async function reserveSelectedAmountBeforeUpload() {
      if (!effectiveOpen) return;
      if (closingModalRef.current) return;
      if (holdExpiryHandledRef.current) return;
      if (reservingHoldRef.current) return;
      if (
        reservationHold?.id &&
        reservationHold?.expires_at &&
        new Date(reservationHold.expires_at).getTime() > Date.now()
      ) {
        return;
      }
      if (
        !activeNumbers.length ||
        totalAmount <= 0 ||
        !Object.keys(holdAmountMap).length ||
        !activeClientHoldKey
      ) {
        return;
      }

      const reservationSignature = JSON.stringify({
        effectiveOpen,
        activeClientHoldKey,
        activeNumbersKey,
        holdAmountMapKey,
        totalAmount,
      });

      if (lastReservationSignatureRef.current === reservationSignature) {
        return;
      }

      lastReservationSignatureRef.current = reservationSignature;
      reservingHoldRef.current = true;
      setReservingHold(true);
      setError("");

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30000);

      try {
        const res = await fetch("/api/holds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientHoldKey: activeClientHoldKey,
            numbers: activeNumbers,
            numberAmounts: holdAmountMap,
            totalAmount,
          }),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const translated =
            translateApiError(data, lang) ||
            tm(lang, "submitFailed");
          throw new Error(translated);
        }

        const normalizedHold = normalizeReservationHoldResponse(
          data,
          activeClientHoldKey,
          activeNumbers,
          holdAmountMap,
          totalAmount,
        );

        if (!normalizedHold) {
          throw new Error("Reservation succeeded, but the server returned invalid hold data.");
        }

        if (normalizedHold.client_hold_key !== activeClientHoldKey) {
          throw new Error("Reservation succeeded, but the hold key did not match this request.");
        }

        // From here, success must win. Do not ignore this response because of
        // React effect cleanup/re-render. A valid 200 hold response is the source of truth.
        localStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(normalizedHold));
        localStorage.setItem("baruda_payment_hold_id", String(normalizedHold.id));

        const nextDraftAmountMap = Object.fromEntries(
          Object.entries(holdAmountMap).map(([number, amount]) => [Number(number), Number(amount)]),
        ) as Record<number, number>;

        const nextDraft: PaymentDraft = {
          clientHoldKey: normalizedHold.client_hold_key,
          numbers: activeNumbers,
          amountMap: nextDraftAmountMap,
          totalAmount,
          expiresAt: normalizedHold.expires_at,
        };

        localStorage.setItem(PAYMENT_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
        setSavedDraft(nextDraft);
        setReservationHold(normalizedHold);
        setReservingHold(false);
        reservingHoldRef.current = false;
        showHoldReadyToast(normalizedHold);

        dispatchNumbersRefresh({
          action: "hold_created",
          numbers: activeNumbers,
          status: "pending",
          holdId: normalizedHold.id,
          clientHoldKey: normalizedHold.client_hold_key,
        });

        broadcastNumbersUpdate({
          action: "hold_created",
          numbers: activeNumbers,
          status: "pending",
          holdId: normalizedHold.id,
          clientHoldKey: normalizedHold.client_hold_key,
          source: "submit-modal-hold",
        });
      } catch (error: any) {
        const isAbort = error?.name === "AbortError";
        const msg = isAbort
          ? "Reservation is taking longer than expected. Please try again."
          : error?.message || tm(lang, "submitFailed");

        setError(msg);
        toast.error(msg);
        localStorage.removeItem(PAYMENT_DRAFT_STORAGE_KEY);
        localStorage.removeItem(HOLD_STORAGE_KEY);
        localStorage.removeItem("baruda_payment_hold_id");
        setSavedDraft(null);
        setReservationHold(null);
        setClientHoldKey(makeClientHoldKey());
        lastReservationSignatureRef.current = "";
        onClose();
      } finally {
        window.clearTimeout(timeoutId);
        reservingHoldRef.current = false;
        setReservingHold(false);
      }
    }

    reserveSelectedAmountBeforeUpload();

    // Do not use a local cancelled flag here. For this payment reservation step,
    // a successful /api/holds response must always be committed to state/storage.
    return undefined;
  }, [
    effectiveOpen,
    activeClientHoldKey,
    activeNumbersKey,
    holdAmountMapKey,
    totalAmount,
    lang,
    onClose,
    reservationHold?.id,
    reservationHold?.expires_at,
  ]);'''

text = text[:start] + replacement + text[end:]
path.write_text(text)
PY

echo "✅ Patched reservation effect: valid /api/holds success now always opens the receipt modal."
echo "\nNext steps:"
echo "  npm run build"
echo "  Test: select number → confirm → watch for POST /api/holds 200 → receipt modal should open immediately after success."
echo "\nRollback if needed:"
echo "  cp '$BACKUP_DIR/SubmitNumberModal.tsx.bak' '$FILE'"
