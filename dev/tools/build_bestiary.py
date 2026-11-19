"""Flow State - Bestiary (Drive markdown export) -> the creature Ancestries' trees (added to module/trees.mjs by build_trees.py) and their Ancestries
and Backgrounds (added to module/abcs.mjs by build_abcs.py, flagged `bestiary`: the player wizard leaves them out).

Structure relied on (every heading is a # heading):
  # **Bestiary Rules**                 -> Tier 0 rules (a rules-only tree)
  # **<Core>** + Tier 0 (Free)         -> a core tree (Wonderborn)
  # **<Lineage>** "*Requires <Core> 1. Lineage tree of ...*"   -> a lineage tree (Dreamborn, Nightmareborn)
  # **<Name>** + **Profile:**          -> an Ancestry (Life): "* **Key:** value" bullets (Omen, Herald, Size "Omen 3, Herald 5", Form, Senses...)
  # **<Name>** (repeated)              -> that Ancestry's own tree (the heading repeats the Ancestry's name). Its lineage is the lineage tree whose note
                                          names its Wonder's type ("Lineage tree of every Dream Omen"), the type read from Flow State - Mental Stage 1
                                          (docs/mental.md: "## **Life (Dream)**"); an old "*Requires <Lineage> 1.*" note still works.
  # **Backgrounds** then # **Omen** / # **Herald** -> "* **Available to:** Wonderborn." / "* **Ancestry Trees:** Tier 3 in ..." / "* **Stat-to-skill ratio:** ... (band 2)"
Usage: build_bestiary.py docs/bestiary.md   (prints what it found; build_trees.py and build_abcs.py import parse_bestiary)
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from build_trees_helpers import clean, slug, normalize, TIER_RE

H1 = re.compile(r'^#\s+\*\*(.+?)\*\*\s*$')
KEYED = re.compile(r'^([^:]{1,60}?):\s*(.*)$')

def sections(md):
    out, cur = [], None
    for raw in normalize(md).split('\n'):
        s = raw.strip()
        m = H1.match(s)
        if m:
            cur = (clean(m.group(1)), [])
            out.append(cur)
        elif cur is not None:
            cur[1].append(raw.rstrip())
    return out

def tree_body(lines, tree):
    """Tier headers and their bullet entries ('* **Name:** text' at the start of a line; indented bullets are sub-entries)."""
    cur = None
    for raw in lines:
        txt = raw.strip()
        t = TIER_RE.match(txt.replace('\\*', '*'))
        if t:
            cur = {"tier": int(t.group(1)), "free": bool(t.group(2)), "summary": clean(t.group(3)), "entries": []}
            tree["tiers"].append(cur)
            continue
        if cur is None or not txt: continue
        b = re.match(r'^[-*]\s+(.*)$', txt)
        body = clean(b.group(1) if b else txt)
        if not body: continue
        top = b and raw[:1] not in (" ", "\t")
        m = KEYED.match(body)
        if top and m:
            cur["entries"].append({"name": m.group(1).strip(), "text": m.group(2).strip()})
        elif cur["entries"]:
            cur["entries"][-1].setdefault("sub", []).append(body)
    return tree

def keyed(lines):
    out = []
    for raw in lines:
        b = re.match(r'^[-*]\s+(.*)$', raw.strip())
        if not b: continue
        m = KEYED.match(clean(b.group(1)))
        if m: out.append([m.group(1).strip(), m.group(2).strip()])
    return out

def note_of(lines):
    return next((clean(l) for l in lines if l.strip().startswith('*') and not l.strip().startswith('**') and not re.match(r'^\*\s', l.strip())), "")

def wonder_kinds():
    """Each Wonder's type from the Mental doc's tree headings: {"life": "dream", "death": "nightmare", ...}."""
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs', 'mental.md')
    try: md = open(p, encoding='utf-8').read()
    except OSError: return {}
    return {slug(n): k.lower() for n, k in re.findall(r'^##\s+\*\*(\w+) \((Dream|Nightmare)\)\*\*', md.replace(chr(13), ''), re.M)}

def parse_bestiary(md):
    trees, ancestries, backgrounds = [], {}, {}
    kinds, lineages = wonder_kinds(), {}           # lineages: "dream" -> the Dreamborn tree's id (from its note)
    core, mode, pending = None, None, None          # pending: the Ancestry whose own tree comes next
    for name, lines in sections(md):
        text = "\n".join(lines)
        if name == "Table of Contents": continue
        if name == "Bestiary Rules":
            trees.append(tree_body(lines, {"id": "ancestry-bestiary-rules", "name": name, "archetype": "ancestry", "rulesOnly": True, "bestiary": True, "requires": 0, "tiers": []}))
            continue
        if name == "Backgrounds": mode = "backgrounds"; continue
        if mode == "backgrounds":
            items = dict((k.lower(), v) for k, v in keyed(lines))
            avail = [slug(n) for n in re.split(r',\s*|\s+and\s+', re.sub(r'\.$', '', items.get("available to", ""))) if n.strip()]
            tier = re.search(r'Tier (\d)', items.get("ancestry trees", ""))
            band = re.search(r'band (\d)', items.get("stat-to-skill ratio", ""))
            ratio = re.search(r'(\d+):1', items.get("stat-to-skill ratio", ""))
            backgrounds[slug(name)] = {"id": slug(name), "name": name, "bestiary": True, "availableCores": avail, "available": [], "trees": [], "options": [],
                                       "differences": [], "tradeSlot": 0, "setTier": int(tier.group(1)) if tier else 0, "sapience": int(band.group(1)) if band else None,
                                       "ratio": int(ratio.group(1)) if ratio else None, "text": {k: v for k, v in keyed(lines)}}
            continue
        if re.search(r'\*\*Profile:\*\*', text):
            prof = keyed(lines)
            get = lambda k: next((v for kk, v in prof if kk.lower() == k), "")
            sizes = {slug(k): int(v) for k, v in re.findall(r'(\w+) (\d)', get("size"))}
            aid = f"{slug(core['name']) if core else 'creature'}-{slug(name)}"
            pending = {"id": aid, "name": name, "core": core["id"] if core else None, "coreName": core["name"] if core else "", "bestiary": True,
                       "size": next(iter(sizes.values()), 3), "sizes": sizes, "form": slug(get("form").rstrip('.')), "wonderName": name,
                       "languages": "", "lifespan": "", "backgrounds": [], "profile": [{"name": k, "text": v} for k, v in prof], "trees": []}
            ancestries[aid] = pending
            continue
        note = note_of(lines)
        req = re.search(r'Requires ([A-Z][\w’\' ]+?) (\d)', note)
        if re.search(r'Tier 0 \(Free\)', text) and not req:
            core = tree_body(lines, {"id": f"ancestry-{slug(name)}", "name": name, "archetype": "ancestry", "core": True, "bestiary": True, "requires": 0, "tiers": [], "ancestries": [], "note": note})
            trees.append(core)
            continue
        tree = {"id": f"ancestry-{slug(name)}", "name": name, "archetype": "ancestry", "bestiary": True, "requires": 0, "tiers": [], "ancestries": [], "note": note}
        if req:
            tree["requiresTree"] = {"id": f"ancestry-{slug(req.group(1))}", "tier": int(req.group(2))}
            tree["requires"] = int(req.group(2))
        if core: tree["core"] = False; tree["coreId"] = core["id"]
        if pending and slug(name) == slug(pending["name"]):
            tree["id"] = f"ancestry-{pending['id']}"
            tree["ancestries"] = [pending["id"]]
            pending["lineage"] = tree.get("requiresTree", {}).get("id") or lineages.get(kinds.get(slug(pending["wonderName"])))
            pending = None
        elif re.search(r'Lineage tree', note):
            tree["lineage"] = True
            k = re.search(r'every (Dream|Nightmare)', note)
            if k: lineages[k.group(1).lower()] = tree["id"]
        trees.append(tree_body(lines, tree))
    # Each Ancestry's trees: its core, its lineage, its own; the lineage trees list the Ancestries under them.
    for a in ancestries.values():
        a["trees"] = [x for x in [a["core"], a.get("lineage"), f"ancestry-{a['id']}"] if x]
    for t in trees:
        if t.get("core") is True: t["ancestries"] = [a["id"] for a in ancestries.values() if a["core"] == t["id"]]
        elif t.get("lineage"): t["ancestries"] = [a["id"] for a in ancestries.values() if a.get("lineage") == t["id"]]
    for b in backgrounds.values():
        cores = {f"ancestry-{c}" for c in b["availableCores"]}
        b["available"] = [a["id"] for a in ancestries.values() if a["core"] in cores]
    for a in ancestries.values():
        a["backgrounds"] = [b["id"] for b in backgrounds.values() if a["id"] in b["available"]]
    return trees, {"ancestries": ancestries, "backgrounds": backgrounds, "rules": next((t for t in trees if t.get("rulesOnly")), None)}

if __name__ == "__main__":
    trees, data = parse_bestiary(open(sys.argv[1], encoding='utf-8').read())
    for t in trees: print(f"tree {t['id']:32} req {t.get('requiresTree')} anc {t.get('ancestries')} tiers {[x['tier'] for x in t['tiers']]} entries {[len(x['entries']) for x in t['tiers']]}")
    for a in data["ancestries"].values(): print(f"ancestry {a['id']:22} sizes {a['sizes']} form {a['form']} trees {a['trees']} bgs {a['backgrounds']}")
    for b in data["backgrounds"].values(): print(f"bg {b['id']:10} setTier {b['setTier']} sapience {b['sapience']} ratio {b['ratio']} avail {b['available']}")
