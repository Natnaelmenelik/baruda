python3 - <<'PY'
from pathlib import Path

p = Path("components/AdminNumbersPanel.tsx")
s = p.read_text()

# 1) Add a scrollable prop to the Modal function
s = s.replace(
'''function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {''',
'''function Modal({
  title,
  children,
  onClose,
  wide = false,
  scrollable = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  scrollable?: boolean;
}) {'''
)

# 2) Make Modal wrapper/content scroll only when scrollable=true
s = s.replace(
'''className={`w-full ${wide ? "max-w-5xl" : "max-w-md"} max-h-[88vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl`}''',
'''className={`w-full ${wide ? "max-w-5xl" : "max-w-md"} ${scrollable ? "flex max-h-[88vh] flex-col overflow-hidden" : "max-h-[88vh] overflow-hidden"} rounded-2xl bg-white dark:bg-slate-900 shadow-2xl`}'''
)

s = s.replace(
'''<div className="flex items-center justify-between px-5 py-4 border-b">''',
'''<div className={`${scrollable ? "shrink-0" : ""} flex items-center justify-between px-5 py-4 border-b`}>'''
)

s = s.replace(
'''<div className="p-5 overflow-auto">{children}</div>''',
'''<div className={scrollable ? "min-h-0 flex-1 overflow-y-auto p-5" : "p-5 overflow-auto"}>{children}</div>'''
)

# 3) Apply scrollable only to Write a Message modal
s = s.replace(
'''title={label("writeDashboardMessage", "Write a Message")}
        >''',
'''title={label("writeDashboardMessage", "Write a Message")}
          scrollable
        >'''
)

p.write_text(s)
print("✅ Targeted only the Write a Message modal and made it vertically scrollable")
PY