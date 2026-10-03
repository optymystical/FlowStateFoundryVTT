"""Convert the Martial/Magic Stage 1 docs (Drive markdown export) into module/trees.mjs.
Structure relied on:
  # **<Arch> Theory**            -> theory tree, Tier 0 free, Tiers 1-5 unlock groups
  # **<Arch> T<n> Skill Trees**   -> following ## trees need Theory tier n
  ## **<Tree name>**              -> a tree
  **Tier N ...: <summary>**       -> tier header; bullets until the next tier/heading are its entries
"""
import json, re, sys

def clean(s):
    s = s.replace('\\*', '*').replace('\\[', '[').replace('\\]', ']').replace('\\#', '#').replace('\\\\', '')
    s = re.sub(r'\\([!*\[\]#_.()+=<>~`|{}-])', r'\1', s)   # any other Markdown escape (e.g. "Heave\!")
    s = re.sub(r'\*+', '', s)            # drop bold/italic markers (the doc's bolding is inconsistent)
    s = s.replace('&#10;', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return re.sub(r'^#+\s*', '', s)     # some doc bullets are heading-styled ("# Minigun:")

def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

TIER_RE = re.compile(r'^\**\s*Tier\s+(\d)\s*(\(Free\))?\s*:\s*(.*?)\**\s*$')

def normalize(md):
    """Newer Drive exports add {#anchors} and indent headings/tier lines; strip both."""
    md = re.sub(r'\s*\{#[^}]*\}', '', md)
    md = re.sub(r'(?m)^[ \t]+(#|\*\*Tier)', r'\1', md)
    md = re.sub(r'(?m)^[ \t]+(\d+\.\s)', r'\1', md)
    return md

def parse(md, arch):
    md = normalize(md)
    trees, cur, cur_tier, group_tier = [], None, None, None
    lines = md.split('\n')
    for raw in lines:
        line = raw.rstrip()
        h1 = re.match(r'^#\s+\*\*(.+?)\*\*\s*$', line)
        h2 = re.match(r'^##\s+\*\*(.+?)\*\*\s*$', line)
        if re.match(r'^#+\s*$', line):
            continue  # empty heading lines in the doc
        if h1:
            title = clean(h1.group(1))
            m = re.match(rf'{arch} T(\d) Skill Trees', title, re.I)
            if re.fullmatch(rf'{arch} Theory', title, re.I):
                cur = {"id": f"{slug(arch)}-theory", "name": title, "archetype": slug(arch), "theory": True, "requires": 0, "tiers": []}
                trees.append(cur); cur_tier = None
            elif m:
                group_tier = int(m.group(1)); cur = None; cur_tier = None
            else:
                cur = None; cur_tier = None
            continue
        if h2:
            if group_tier is None: continue
            name = clean(h2.group(1))
            if not name: continue
            cur = {"id": f"{slug(arch)}-{slug(name)}", "name": name, "archetype": slug(arch), "theory": False, "requires": group_tier, "tiers": []}
            trees.append(cur); cur_tier = None
            continue
        if cur is None: continue
        t = TIER_RE.match(clean(line).join(['','']) if False else line.strip().replace('\\*','*'))
        if t:
            cur_tier = {"tier": int(t.group(1)), "free": bool(t.group(2)), "summary": clean(t.group(3)), "entries": []}
            cur["tiers"].append(cur_tier)
            continue
        if cur_tier is None: continue
        txt = line.strip()
        if not txt or txt.startswith('<!--'): continue
        numbered = re.match(r'^(\d+)\.\s+(.*)$', txt)
        bullet = re.match(r'^-\s+(.*)$', txt)
        body = clean(numbered.group(2) if numbered else bullet.group(1) if bullet else txt)
        if not body or body == "-": continue
        if numbered: body = f"{numbered.group(1)}. {body}"
        # Numbered option lists, deeper bullets, and loose paragraphs belong to the entry above them.
        # Mental lists its Modes and Tenets as plain paragraphs at the left margin (no bullet): each is its own entry.
        flush = arch == "Mental" and not bullet and not numbered and raw[:1] not in (" ", "\t")
        nested = bool(numbered) or raw.startswith('      ') or (not bullet and not flush and cur_tier["entries"])
        m = re.match(r'^([^:]{1,60}?):\s*(.*)$', body)
        entry = {"name": m.group(1).strip(), "text": m.group(2).strip()} if ((bullet or flush) and m and not nested) else {"name": "", "text": body}
        if nested and cur_tier["entries"]:
            cur_tier["entries"][-1].setdefault("sub", []).append(body)
        else:
            cur_tier["entries"].append(entry)
    return trees

out = []
for path, arch in [(sys.argv[1], "Martial"), (sys.argv[2], "Magic"), (sys.argv[3], "Mental")]:
    trees = parse(open(path).read(), arch)
    if arch == "Mental":
        # The Mental Rework Test Ground still has empty trees (Ponderance / Snappence / Esoteric Arts): leave those out until they're written.
        trees = [t for t in trees if any(x["entries"] for x in t["tiers"])]
    out += trees
js = "// Generated from the Martial and Magic Stage 1 docs and the Mental Rework Test Ground by tools/build_trees.py. Don't edit by hand; re-run the converter.\n"
js += "export const TREES = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n"
open(sys.argv[4], 'w').write(js)
for t in out:
    print(f"{t['archetype']:8} req T{t['requires']}  {t['name']:24} tiers {[x['tier'] for x in t['tiers']]}  entries {[len(x['entries']) for x in t['tiers']]}")
