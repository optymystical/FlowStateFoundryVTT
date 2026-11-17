"""Flow State - ABCs (Drive markdown export) -> ancestry trees for module/trees.mjs (via build_trees.py) and module/abcs.mjs (Ancestries,
Backgrounds, Homelands, Circles).

Structure relied on:
  # **ABC Rules**                 -> Tier 0 rules (a rules-only tree)
  # **Ancestries**                 -> "- **<Ancestry>:** Wusonian, Commonkin, and Human." (each Ancestry's trees; the Wasteling's is "Wasteling in
                                     place of your original core": a variant, system.abc.wasteling)
  # **<Ancestry>** + **Profile:** -> an Ancestry (its "- **Key:** value" bullets)
  # **<Core>** + Tier 0 (Free)    -> a core tree (Wusonian, Lakeborn, Strigid, Leporid, Wasteling); its ## trees are lineage or shared trees
  # **Ancestry Trees**            -> ## each Ancestry's own trees (one named like its Ancestry gets the id ancestry-<id>-tree). No tree requires another.
  # **Backgrounds**               -> ## each Background: Available to / Starting Trees (+ focus/path bullets) / Ancestry Differences / Trade Slot / Circle
  # **Cultures**                  -> ## Shared Homelands, ## <Ancestry> Homelands, ## Shared Circles, ## Background Circles ("Name (Background)")
Usage: build_abcs.py docs/abcs.md ../module/abcs.mjs [docs/bestiary.md]   (build_trees.py imports parse_trees for the trees; the Bestiary's
Ancestries and Backgrounds, flagged `bestiary`, are added to the same tables)
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

def inches(s):
    """'5 ft 4 in' / '6 ft' / '10 in' -> inches, or None."""
    m = re.match(r'\s*(?:(\d+)\s*ft)?\s*(?:(\d+)\s*in)?', s)
    if not m or (m.group(1) is None and m.group(2) is None): return None
    return int(m.group(1) or 0) * 12 + int(m.group(2) or 0)

def height_range(s):
    """'5 ft to 6 ft 4 in.' -> [60, 76]; 'As your original Ancestry...' -> None (the Wasteling's is worked out from the original)."""
    m = re.match(r'^\s*(.+?)\s+to\s+(.+?)(?:[.,]|$)', s)
    if not m: return None
    lo, hi = inches(m.group(1)), inches(m.group(2))
    return [lo, hi] if lo is not None and hi is not None else None

def weight_range(s):
    """'100 to 250 lb.' -> [100, 250]."""
    m = re.match(r'^\s*(\d+)\s+to\s+(\d+)\s*lb', s)
    return [int(m.group(1)), int(m.group(2))] if m else None

def name_list(s):
    """'Human, Dwarf, and Fire Walker.' -> ['Human', 'Dwarf', 'Fire Walker']"""
    s = re.sub(r'\.$', '', s.strip())
    parts = re.split(r',\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+', s)
    return [p.strip() for p in parts if p.strip()]

def parse_trees_and_data(md):
    secs = sections(md)
    trees, ancestries, backgrounds, homelands, circles = [], {}, {}, [], []
    lists = {}                       # "# Ancestries": Ancestry name -> its trees' names (or the Wasteling's "in place of your original core")
    core, mode = None, None
    for level, name, lines in secs:
        text = "\n".join(lines)
        if level == 1:
            if name == "Table of Contents": mode = None; continue
            if name in ("Backgrounds", "Cultures"): mode = name; continue
            if name == "Ancestries":
                mode = "list"
                for k, v in bullets(lines): lists[k] = v
                continue
            if name == "Ancestry Trees": mode = "own"; core = None; continue
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
                ancestries[aid] = {"id": aid, "name": name, "core": None, "size": int(size.group(1)) if size else 3,
                                   "height": height_range(get("height")), "weight": weight_range(get("weight")),
                                   "languages": get("languages"), "lifespan": get("lifespan"),
                                   "backgrounds": [slug(b) for b in name_list(get("backgrounds"))],
                                   "profile": [{"name": k, "text": v} for k, v in prof], "trees": []}
                continue
            # A core tree (Tier 0 free, no Profile): Wusonian, Lakeborn, Strigid, Leporid, Wasteling. Its first line says what it's the core of.
            mode = "core"
            note = next((clean(l) for l in lines if l.strip() and not TIER_RE.match(l.strip().replace('\\*', '*'))), "")
            core = tree_body(lines, {"id": f"ancestry-{slug(name)}", "name": name, "archetype": "ancestry", "core": True, "requires": 0, "tiers": [], "ancestries": [], "note": note})
            if re.search(r'replaces the core tree', note): core["replacesCore"] = True
            trees.append(core)
            continue
        # ## headings: the lineage and shared trees (under a core), and each Ancestry's own trees (under "Ancestry Trees"). No tree requires another.
        if mode in ("core", "own"):
            tid = f"ancestry-{slug(name)}"
            if mode == "own" and slug(name) in ancestries: tid += "-tree"
            note = next((clean(l) for l in lines if l.strip().startswith('*') and not l.strip().startswith('**')), "")
            tree = {"id": tid, "name": name, "archetype": "ancestry", "requires": 0, "tiers": [], "ancestries": [], "note": note, "core": False}
            if re.search(r'Lineage tree', note): tree["lineage"] = True
            if mode == "core" and core: tree["coreId"] = core["id"]
            tree["_own"] = mode == "own"
            trees.append(tree_body(lines, tree))
            continue
        if mode == "Backgrounds":
            backgrounds[slug(name)] = parse_background(name, lines, [a["name"] for a in ancestries.values()])
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
    # Each Ancestry's trees, from the "# Ancestries" list (its core, its lineage tree, its own trees); each tree lists its Ancestries.
    def resolve(n):
        named = [t for t in trees if t["name"] == n and not t.get("rulesOnly")]
        return next((t for t in named if t.get("_own")), None) or (named[0] if named else None)
    for a in ancestries.values():
        listed = lists.get(a["name"], "")
        if re.search(r'in place of your original core', listed):
            # The Wasteling: its core replaces the original Ancestry's core (system.abc.wasteling); it isn't an Ancestry of its own.
            a["variant"] = "wasteling"
            w = next((t for t in trees if t.get("replacesCore")), None)
            a["core"] = w["id"] if w else None
            a["trees"] = [w["id"]] if w else []
            continue
        for n in name_list(listed):
            t = resolve(n)
            if not t: print(f"WARNING: {a['name']} lists an unknown tree {n!r}"); continue
            a["trees"].append(t["id"])
            if a["id"] not in t["ancestries"]: t["ancestries"].append(a["id"])
            if t.get("core") and not a["core"]: a["core"] = t["id"]
    for t in trees: t.pop("_own", None)
    for b in backgrounds.values():
        named = re.match(r'^(.+?),?\s+or a Shared Circle', b["text"].get("Circle", ""))
        for nm in ([named.group(1).strip()] if named else []):
            if re.match(r"(a circle|one of)", nm.lower()) or any(c["background"] == b["id"] and c["name"] == nm for c in circles): continue
            circles.append({"id": f"{b['id']}.{slug(nm)}", "name": nm, "text": "", "background": b["id"]})
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

def parse_background(name, lines, names=()):
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
            if re.search(r'build this Background yourself|any skill trees', val):
                m2 = re.search(r'(\d+) free points', val)
                bg["anyPoints"] = int(m2.group(1)) if m2 else 15
            elif re.search(r'Ancestry’s trees|Ancestry\'s trees', val):
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
            bg["differences"] = parse_differences(val, names)
        elif key == "Circle":
            in_options = False
        elif in_options:
            bg["options"].append({"name": key, "trees": parse_list(val)})
    return bg

def parse_differences(val, names=()):
    """'Dwarf: Heavy Armor T2 replaces Medium Armor T2.' / 'Fire Walker: Elementalist only, and the school must be Heat. Orc: Warder only.' /
    'Fire Walker: Mental Theory T3, Light T2, Resolve T2, and Persuasion T2.'"""
    names = sorted(names or ["Fire Walker", "Drakenblood", "Halfling", "Human", "Dwarf", "Elf", "Dusken", "Orc", "Goblin"], key=len, reverse=True)
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
    if len(sys.argv) > 3:
        from build_bestiary import parse_bestiary
        _, best = parse_bestiary(open(sys.argv[3], encoding='utf-8').read())
        data["ancestries"].update(best["ancestries"])
        data["backgrounds"].update(best["backgrounds"])
        data["bestiaryRules"] = best["rules"]
    js = "// Generated from Flow State - ABCs by tools/build_abcs.py. Don't edit by hand; re-run `npm run trees`.\n"
    js += "export const ABC_RULES = " + json.dumps(data["rules"], indent=1, ensure_ascii=False) + ";\n"
    js += "export const BESTIARY_RULES = " + json.dumps(data.get("bestiaryRules"), indent=1, ensure_ascii=False) + ";\n"
    for k in ("ancestries", "backgrounds", "homelands", "circles"):
        js += f"export const {k.upper()} = " + json.dumps(data[k], indent=1, ensure_ascii=False) + ";\n"
    open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write(js)
    for t in trees: print(f"tree {t['id']:30} req {t.get('requiresTree')} anc {t.get('ancestries')} tiers {[x['tier'] for x in t['tiers']]}")
    for b in data["backgrounds"].values():
        bad = [x for x in b["trees"] + [y for o in b["options"] for y in o["trees"]] + [y for d in b["differences"] for y in d.get("trees", [])] if "unparsed" in x]
        print(f"bg {b['id']:24} avail {b['available'] if b['available']=='all' else len(b['available'])} items {len(b['trees'])} opts {len(b['options'])} diffs {len(b['differences'])} {'UNPARSED ' + str(bad) if bad else ''}")
    print(len(data["homelands"]), "homelands", len(data["circles"]), "circles")
