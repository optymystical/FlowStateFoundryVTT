#!/usr/bin/env python3
"""Generate module/combos.mjs from the Combo Spell List snapshot (dev/docs/combos.md). Usage: build_combos.py <combos.md> <out.mjs>"""
import re, sys, json

SCHOOLS = ["gravity", "slashing", "piercing", "crushing", "heat", "cold", "radiation", "acid", "venomancy", "charm", "witchery",
           "summoning", "creation", "animation", "geomancy", "illusion", "arcanomancy"]

def clean(s):
    s = s.replace("\\*", "*")
    s = re.sub(r"\*+", "", s)
    return re.sub(r"\s+", " ", s).strip()

def main(src, out):
    pairs, generic, bonus, illusion = {}, {}, {}, {}
    section = ""
    for raw in open(src, encoding="utf8").read().split("\n"):
        line = raw.strip()
        if line.startswith("## "):
            section = clean(line).lstrip("# ").strip()
            continue
        m = re.match(r"^\*\*([^*]+?):\*\*\s*(?:\*\*\*([^*]+?)\*\*\*)?\s*(.*)$", line)
        if not m:
            continue
        name, head, text = clean(m.group(1)), clean(m.group(2) or ""), clean(m.group(3))
        low = name.lower()
        if low in SCHOOLS or low == "hex":
            (illusion if section == "Illusion Combos" else bonus)[low] = text
            continue
        if low.startswith("any t1/t2/t3 + "):
            generic[low.split("+")[1].strip()] = {"head": head, "text": text}
            continue
        if low.startswith("t1/t2/t3/t4 + "):
            generic["arcanomancy"] = {"head": head, "text": text}
            continue
        parts = [p.strip() for p in low.split("+")]
        if len(parts) == 2 and all(p in SCHOOLS for p in parts):
            pairs["+".join(sorted(parts))] = {"head": head, "text": text}
    body = "// Generated from the Combo Spell List by tools/build_combos.py. Don't edit by hand; re-run the converter.\n"
    body += "export const COMBO_PAIRS = " + json.dumps(pairs, indent=1, ensure_ascii=False) + ";\n"
    body += "export const COMBO_GENERIC = " + json.dumps(generic, indent=1, ensure_ascii=False) + ";\n"
    body += "export const COMBO_BONUS = " + json.dumps(bonus, indent=1, ensure_ascii=False) + ";\n"
    body += "export const COMBO_ILLUSION = " + json.dumps(illusion, indent=1, ensure_ascii=False) + ";\n"
    open(out, "w", encoding="utf8").write(body)
    print(f"{len(pairs)} listed pairs, {len(generic)} generic combos, {len(bonus)} bonus effects, {len(illusion)} illusion effects")

main(sys.argv[1], sys.argv[2])
