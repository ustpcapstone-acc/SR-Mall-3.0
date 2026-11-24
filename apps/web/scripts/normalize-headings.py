"""
One heading style for the whole site: the serif display face (font-display),
semibold, normal case, on a fixed size scale.

  - Page titles (<h1>) on dashboard pages (admin, tenant, customer account):
        font-display text-2xl sm:text-3xl font-semibold tracking-tight
  - Page titles (<h1>) on public pages:
        font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight
  - Section titles (<h2> at text-2xl or larger) get font-display.
  - Every <h1>/<h2>/<h3> that is bold or black becomes semibold.
Small card titles (below text-2xl) keep the body font.

Only page files get the <h1> scale (components, 404, auth and debug pages keep
their own sizes). Colours and layout classes are never changed.
Usage: python scripts/normalize-headings.py   (run from apps/web)
"""
import glob
import re

DASHBOARD = ("src/app/admindashboard/", "src/app/tenantdashboard/", "src/app/account/")
SKIP_H1 = ("src/app/not-found", "src/app/auth/", "src/app/debug/", "src/app/admin/")
SCALE_TOKEN = re.compile(
    r"^(?:[a-z0-9]+:)*(?:text-(?:xs|sm|base|lg|[0-9]?xl|\[[^\]]+\])|leading-\S+|tracking-\S+|font-(?:bold|black|semibold|medium|extrabold|display|sans))$"
)
BIG = re.compile(r"(?:^|\s)(?:[a-z0-9]+:)*text-(?:2xl|3xl|4xl|5xl|6xl|7xl|8xl|\[(?:[2-9]\d|1\d\d)px\]|\[[2-9](?:\.\d+)?rem\])(?=\s|$)")
H1 = re.compile(r'(<h1\b[^>]*?className=")([^"]*)(")')
H23 = re.compile(r'(<h([23])\b[^>]*?className=")([^"]*)(")')

DASH_H1 = "font-display text-2xl sm:text-3xl font-semibold tracking-tight"
PUBLIC_H1 = "font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight"


def semibold(c: str) -> str:
    return re.sub(r"(^|\s)((?:[a-z0-9]+:)*)font-(?:bold|black|extrabold)(?=\s|$)", r"\1\2font-semibold", c)


def page_h1(c: str, scale: str) -> str:
    return " ".join([scale] + [t for t in c.split() if not SCALE_TOKEN.match(t)])


def section_h2(c: str) -> str:
    c = semibold(c)
    if BIG.search(c) and "font-display" not in c.split():
        c = "font-display " + c
    return c


changed = 0
for path in glob.glob("src/**/*.tsx", recursive=True):
    p = path.replace("\\", "/")
    src = open(path, encoding="utf-8", newline="").read()
    is_page = p.startswith("src/app/") and p.endswith("page.tsx") and not p.startswith(SKIP_H1)
    scale = DASH_H1 if p.startswith(DASHBOARD) else PUBLIC_H1

    def fix_h1(m):
        c = m.group(2)
        return m.group(1) + (page_h1(c, scale) if is_page else semibold(c)) + m.group(3)

    def fix_h23(m):
        c = m.group(3)
        return m.group(1) + (section_h2(c) if m.group(2) == "2" else semibold(c)) + m.group(4)

    out = H23.sub(fix_h23, H1.sub(fix_h1, src))
    if out != src:
        open(path, "w", encoding="utf-8", newline="").write(out)
        changed += 1
        print("updated", p)
print("files", changed)
