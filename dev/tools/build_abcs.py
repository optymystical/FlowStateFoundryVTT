"""Flow State - ABCs (Drive markdown export) -> ancestry trees for module/trees.mjs (via build_trees.py) and module/abcs.mjs (Ancestries,
Backgrounds, Homelands, Circles).

Structure relied on:
  # **ABC Rules**                 -> Tier 0 rules (a rules-only tree)
  # **<Core>** + Tier 0 (Free)    -> an Ancestry core tree (Wusonian); its ## trees are lineage trees ("*Requires Wusonian 1. Lineage tree of the
                                     Human line: Human, Dwarf, ...*") or shared trees ("*Halfling or Goblin only. ...*")
  # **<Ancestry>** + **Profile:** -> an Ancestry (its "- **Key:** value" bullets); its ## trees belong to it ("*Requires Commonkin 2.*")
  # **Backgrounds**               -> ## each Background: Available to / Starting Trees (+ focus/path bullets) / Ancestry Differences / Trade Slot / Circle
  # **Cultures**                  -> ## Shared Homelands, ## <Ancestry> Homelands, ## Shared Circles, ## Background Circles ("Name (Background)")
Usage: build_abcs.py docs/abcs.md ../module/abcs.mjs   (build_trees.py imports parse_trees for the trees)
"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build_trees_helpers import clean, slug, normalize, TIER_RE

H1 = re.compile(r'^#\s+\*\*(.+?)\*\*\s*$')
H2 = re.compile(r'^##\s+\*\*(.+?)\*\*\s*$')
KEYED = re.compile(r'^([^:]{1,60}?):\s*(.*)$')

def sections(md):
    """[(level, name, [lines])] for every # and ## heading."""
    out, cur = [], None
    for raw in normalize(md).split('\n'):
        s = raw.strip()
        m1, m2 = H1.match(s), H2.match(s)
        if m1 or m2:
            cur = (1 if m1 else 2, clean((m1 or m2).group(1)), [])
            out.append(cur)
        elif cur is not None:
            cur[2].append(raw.rstrip())
    return out

def tree_body(lines, tree):
    """Tier headers and their bullet entries (as build_trees.py's Generic parser)."""
    cur_tier = None
    for raw in lines:
        txt = raw.strip()
        t = TIER_RE.match(txt.replace('\\*', '*'))
        if t:
            cur_tier = {"tier": int(t.group(1)), "free": bool(t.group(2)), "summary": clean(t.group(3)), "entries": []}
            tree["tiers"].append(cur_tier)
            continue
        if cur_tier is None or not txt: continue
        bullet = re.match(r'^[-*]\s+(.*)$', txt)
        body = clean(bullet.group(1) if bullet else txt)
        if not body: continue
        top = bullet and txt.startswith('-') and raw[:1] not in (" ", "\t")
        m = KEYED.match(body)
        if top and m:
            cur_tier["entries"].append({"name": m.group(1).strip(), "text": m.group(2).strip()})
        elif cur_tier["entries"]:
            cur_tier["entries"][-1].setdefault("sub", []).append(body)
    return tree

def bullets(lines):
    """Top-level '- **Key:** text' bullets as [(key, text)]; '* ' sub-bullets are appended to the one above."""
    out = []
    for raw in lines:
        txt = raw.strip()
        b = re.match(r'^([-*])\s+(.*)$', txt)
        if not b: continue
        body = clean(b.group(2))
        m = KEYED.match(body)
        if m and b.group(1) == '-': out.append([m.group(1).strip(), m.group(2).strip()])
        elif out: out[-1][1] += " " + body
    return out

def name_list(s):
    """'Human, Dwarf, and Fire Walker.' -> ['Human', 'Dwarf', 'Fire Walker']"""
    s = re.sub(r'\.$', '', s.strip())
    parts = re.split(r',\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+', s)
    return [p.strip() for p in parts if p.strip()]

def parse_trees_and_data(md):
    secs = sections(md)
    trees, ancestries, backgrounds, homelands, circles = [], {}, {}, [], []
    core, ancestry, mode = None, None, None
    for level, name, lines in secs:
        text = "\n".join(lines)
        if level == 1:
            ancestry = None
            if name == "Table of Contents": mode = None; continue
            if name in ("Backgrounds", "Cultures"): mode = name; continue
            if name == "ABC Rules":
                mode = "rules"
                trees.append(tree_body(lines, {"id": "ancestry-abc-rules", "name": name, "archetype": "ancestry", "rulesOnly": True, "requires": 0, "tiers": []}))
                continue
            if re.search(r'\*\*Profile:\*\*', text):
                mode = "ancestry"
                aid = slug(name)
                prof = bullets(lines)
                get = lambda k: next((v for kk, v in prof if kk.lower() == k), "")
                size = re.search(r'(\d)', get("size"))
                ancestry = {"id": aid, "name": name, "core": core["id"] if core else None, "size": int(size.group(1)) if size else 3,
                            "languages": get("languages"), "lifespan": get("lifespan"),
                            "backgrounds": [slug(b) for b in name_list(get("backgrounds"))],
                            "profile": [{"name": k, "text": v} for k, v in prof], "trees": []}
                ancestries[aid] = ancestry
                continue
            # A core tree (Tier 0 free, no Profile).
            mode = "core"
            core = tree_body(lines, {"id": f"ancestry-{slug(name)}", "name": name, "archetype": "ancestry", "core": True, "requires": 0, "tiers": [], "ancestries": []})
            trees.append(core)
            continue
        # ## headings
        if mode in ("core", "ancestry"):
            tree = {"id": f"ancestry-{slug(name)}", "name": name, "archetype": "ancestry", "requires": 0, "tiers": [], "ancestries": []}
            if mode == "ancestry" and ancestry:
                tree["id"] = f"ancestry-{slug(name)}" if slug(name) != ancestry["id"] else f"ancestry-{ancestry['id']}-tree"
            note = next((clean(l) for l in lines if l.strip().startswith('*') and not l.strip().startswith('**')), "")
            req = re.search(r'Requires ([A-Z][\w’\' ]+?) (\d)', note)
            if req:
                tree["requiresTree"] = {"id": f"ancestry-{slug(req.group(1))}", "tier": int(req.group(2))}
                tree["requires"] = int(req.group(2))
            line = re.search(r'line: ([^.]+)\.', note)
            only = re.match(r'^(.+?) only\.', note)
            if line: tree["ancestries"] = [slug(n) for n in name_list(line.group(1))]; tree["lineage"] = True
            elif only: tree["ancestries"] = [slug(n) for n in name_list(only.group(1))]
            elif mode == "ancestry" and ancestry: tree["ancestries"] = [ancestry["id"]]
            tree["note"] = note
            if core: tree["core"] = False; tree["coreId"] = core["id"]
            trees.append(tree_body(lines, tree))
            continue
        if mode == "Backgrounds":
            backgrounds[slug(name)] = parse_background(name, lines)
            continue
        if mode == "Cultures":
            items = bullets(lines)
            if name.endswith("Homelands"):
                anc = None if name.startswith("Shared") else slug(name[:-len(" Homelands")])
                for k, v in items: homelands.append({"id": f"{anc or 'shared'}.{slug(k)}", "name": k, "text": v, "ancestry": anc})
            elif name.endswith("Circles"):
                for k, v in items:
                    m = re.match(r'^(.+?)\s*\((.+)\)$', k)
                    nm, bg = (m.group(1), slug(m.group(2))) if m else (k, None)
                    circles.append({"id": f"{bg or 'shared'}.{slug(nm)}", "name": nm, "text": v, "background": bg})
            continue
    # Ancestry trees: each tree lists its Ancestries; each Ancestry lists its trees (core, lineage, own).
    for a in ancestries.values():
        a["trees"] = [t["id"] for t in trees if t.get("core") and t["id"] == a["core"]] + [t["id"] for t in trees if a["id"] in t.get("ancestries", [])]
    for t in trees:
        if t.get("core"): t["ancestries"] = [a["id"] for a in ancestries.values() if a["core"] == t["id"]]
    return trees, {"ancestries": ancestries, "backgrounds": backgrounds, "homelands": homelands, "circles": circles,
                   "rules": next((t for t in trees if t.get("rulesOnly")), None)}

def parse_list(s):
    """A Starting Trees list -> items: {tree:name, tier} | {choose:[names], tier} | {school:{min,max}, tier}. Names are resolved in JS."""
    s = re.sub(r'\([^)]*\)', '', s)
    s = re.sub(r',?\s*plus one (focus|path):?\s*$', '', s.strip())
    s = re.sub(r'\.\s*$', '', s.strip())
    items, holes = [], []
    def hold(item):
        holes.append(item); return f"@{len(holes) - 1}@"
    s = re.sub(r'one Magic T(\d) or T(\d) school of your choice at T(\d)', lambda m: hold({"school": {"min": int(m.group(1)), "max": int(m.group(2))}, "tier": int(m.group(3))}), s)
    s = re.sub(r'one of (.+?) at T(\d)', lambda m: hold({"choose": name_list(m.group(1)), "tier": int(m.group(2))}), s)
    s = re.sub(r'either (.+?) T(\d) or (.+?) T(\d)', lambda m: hold({"choose": [m.group(1).strip(), m.group(3).strip()], "tier": int(m.group(2))} if m.group(2) == m.group(4)
                                                                   else {"either": [{"tree": m.group(1).strip(), "tier": int(m.group(2))}, {"tree": m.group(3).strip(), "tier": int(m.group(4))}]}), s)
    for part in re.split(r',\s*(?:and\s+)?|\s+and\s+', s):
        part = part.strip()
        if not part: continue
        h = re.fullmatch(r'@(\d+)@', part)
        if h: items.append(holes[int(h.group(1))]); continue
        m = re.fullmatch(r'(.+?) T(\d)', part)
        if m: items.append({"tree": m.group(1).strip(), "tier": int(m.group(2))})
        else: items.append({"unparsed": part})
    return items

def parse_background(name, lines):
    bg = {"id": slug(name), "name": name, "available": [], "trees": [], "options": [], "differences": [], "tradeSlot": 0, "text": {}}
    in_options = False
    for raw in lines:
        txt = raw.strip()
        b = re.match(r'^[-*]\s+(.*)$', txt)
        if not b: continue
        body = clean(b.group(1))
        m = KEYED.match(body)
        if not m: continue
        key, val = m.group(1).strip(), m.group(2).strip()
        bg["text"][key] = val
        if key == "Available to":
            in_options = False
            bg["available"] = "all" if val.lower().startswith("every") else [slug(n) for n in name_list(val)]
        elif key == "Starting Trees":
            in_options = bool(re.search(r'plus one (focus|path)', val))
            if re.search(r'Ancestry’s trees|Ancestry\'s trees', val):
                m2 = re.search(r'(\d+) points', val)
                bg["ancestryPoints"] = int(m2.group(1)) if m2 else 15
            else:
                bg["trees"] = parse_list(val)
        elif key == "Trade Slot":
            in_options = False
            m2 = re.search(r'(\d+) points', val)
            bg["tradeSlot"] = int(m2.group(1)) if m2 else 0
            held = re.search(r'held for now by (.+?) as (?:a )?placeholders?', val)
            if held: bg["trees"] += [dict(x, trade=True) for x in parse_list(held.group(1))]
        elif key == "Ancestry Differences":
            in_options = False
            bg["differences"] = parse_differences(val)
        elif key == "Circle":
            in_options = False
        elif in_options:
            bg["options"].append({"name": key, "trees": parse_list(val)})
    return bg

def parse_differences(val):
    """'Dwarf: Heavy Armor T2 replaces Medium Armor T2.' / 'Fire Walker: Elementalist only, and the school must be Heat. Orc: Warder only.' /
    'Fire Walker: Mental Theory T3, Light T2, Resolve T2, and Persuasion T2.'"""
    names = ["Fire Walker", "Drakenblood", "Halfling", "Human", "Dwarf", "Elf", "Dusken", "Orc", "Goblin"]
    pat = re.compile(r'(' + '|'.join(re.escape(n) for n in names) + r'):\s*')
    marks = list(pat.finditer(val))
    out = []
    for i, m in enumerate(marks):
        seg = val[m.end(): marks[i + 1].start() if i + 1 < len(marks) else len(val)].strip()
        d = {"ancestry": slug(m.group(1)), "text": seg}
        rep = re.match(r'^(.+?) T(\d) replaces (.+?) T(\d)\.?$', seg)
        only = re.match(r'^(.+?) only(?:, and the school must be (\w+))?\.?$', seg)
        if rep: d["replace"] = {"tree": rep.group(1), "tier": int(rep.group(2)), "from": rep.group(3)}
        elif only: d["only"] = only.group(1); d["mustBe"] = only.group(2)
        else: d["trees"] = parse_list(seg)
        out.append(d)
    return out

if __name__ == "__main__":
    md = open(sys.argv[1], encoding='utf-8').read()
    trees, data = parse_trees_and_data(md)
    js = "// Generated from Flow State - ABCs by tools/build_abcs.py. Don't edit by hand; re-run `npm run trees`.\n"
    js += "export const ABC_RULES = " + json.dumps(data["rules"], indent=1, ensure_ascii=False) + ";\n"
    for k in ("ancestries", "backgrounds", "homelands", "circles"):
        js += f"export const {k.upper()} = " + json.dumps(data[k], indent=1, ensure_ascii=False) + ";\n"
    open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write(js)
    for t in trees: print(f"tree {t['id']:30} req {t.get('requiresTree')} anc {t.get('ancestries')} tiers {[x['tier'] for x in t['tiers']]}")
    for b in data["backgrounds"].values():
        bad = [x for x in b["trees"] + [y for o in b["options"] for y in o["trees"]] + [y for d in b["differences"] for y in d.get("trees", [])] if "unparsed" in x]
        print(f"bg {b['id']:24} avail {b['available'] if b['available']=='all' else len(b['available'])} items {len(b['trees'])} opts {len(b['options'])} diffs {len(b['differences'])} {'UNPARSED ' + str(bad) if bad else ''}")
    print(len(data["homelands"]), "homelands", len(data["circles"]), "circles")
