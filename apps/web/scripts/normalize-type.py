"""
Typography normalizer for Tailwind class strings in .tsx files.

Only touches double-quoted or backtick strings whose every token looks like a
Tailwind class. Rules (the formal, readable style of the rebuild):
  - drop `uppercase`
  - drop wide letter spacing: tracking-wide/wider/widest/[0.xem] (any variant prefix)
  - tracking-tighter -> tracking-tight
  - font-black -> font-semibold (and drop `italic` in the same string)
  - text-[7px]..text-[9px] -> text-xs; text-[10px]/[11px] -> text-xs when the
    string was uppercase or tracked (caps read larger than lowercase)
Usage: python normalize_type.py FILE...   (prints a per-file change count)
"""
import re
import sys

CLASS_TOKEN = re.compile(r"^[!a-z0-9:\-\[\]/.%#()_,&>*+=@]+$", re.I)
STRING = re.compile(r'"([^"\n]*)"|`([^`$\n]*)`')
WIDE = re.compile(r"^((?:[a-z0-9\-\[\]]+:)*)tracking-(wide|wider|widest|\[0?\.\d+em\])$")
TINY = re.compile(r"^((?:[a-z0-9\-\[\]]+:)*)text-\[(\d+(?:\.\d+)?)px\]$")


def transform(value: str) -> str:
    tokens = value.split()
    if not tokens or not all(CLASS_TOKEN.match(t) for t in tokens):
        return value
    lowered = [t.split(":")[-1] for t in tokens]
    had_upper = "uppercase" in lowered
    had_track = any(WIDE.match(t) for t in tokens)
    had_black = "font-black" in lowered
    if not (had_upper or had_track or had_black or "tracking-tighter" in lowered or any(TINY.match(t) for t in tokens)):
        return value
    out = []
    for t in tokens:
        base = t.split(":")[-1]
        prefix = t[: len(t) - len(base)]
        if base == "uppercase":
            continue
        if WIDE.match(t):
            continue
        if base == "tracking-tighter":
            out.append(prefix + "tracking-tight")
            continue
        if base == "font-black":
            out.append(prefix + "font-semibold")
            continue
        if base == "italic" and had_black:
            continue
        m = TINY.match(t)
        if m:
            px = float(m.group(2))
            if px < 10 or (px < 12 and (had_upper or had_track)):
                out.append(m.group(1) + "text-xs")
                continue
        out.append(t)
    return " ".join(out)


def process(path: str) -> int:
    src = open(path, encoding="utf-8", newline="").read()
    changes = 0

    def repl(m):
        nonlocal changes
        quote = '"' if m.group(1) is not None else "`"
        value = m.group(1) if m.group(1) is not None else m.group(2)
        new = transform(value)
        if new != value:
            changes += 1
        return f"{quote}{new}{quote}"

    out = STRING.sub(repl, src)
    if out != src:
        open(path, "w", encoding="utf-8", newline="").write(out)
    return changes


if __name__ == "__main__":
    total = 0
    for p in sys.argv[1:]:
        n = process(p)
        total += n
        if n:
            print(f"{n:4d}  {p}")
    print(f"total {total}")
