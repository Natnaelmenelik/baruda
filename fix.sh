python3 - <<'PY'
from pathlib import Path

p = Path("components/SubmitNumberModal.tsx")
s = p.read_text()

s = s.replace(
    "lastReservationSignatureRef.current = null;",
    'lastReservationSignatureRef.current = "";'
)

p.write_text(s)
print("✅ Fixed lastReservationSignatureRef null TypeScript error")
PY