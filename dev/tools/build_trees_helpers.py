"""Shared by build_trees.py and build_abcs.py: Markdown cleanup, slugs, the tier header pattern."""
import re

def clean(s):
    s = s.replace('\\*', '*').replace('\\[', '[').replace('\\]', ']').replace('\\#', '#').replace('\\\\', '')
    s = re.sub(r'\\([!*\[\]#_.()+=<>~`|{}-])', r'\1', s)   # any other Markdown escape (e.g. "Heave\!")
    s = re.sub(r'\*+', '', s)            # drop bold/italic markers (the doc's bolding is inconsistent)
    s = re.sub(r'\[([^\]]+)\]\(https?://[^)]*\)', r'\1', s)   # a link to another doc ("[Combo Spell](https://docs...)") keeps only its words
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
