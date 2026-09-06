"""
Generate INDEX.md - a map of every source file in the repo, what it does, and
what it defines.

Auto-generated rather than hand-written so it cannot drift from the code. Run
it after any structural change:

    python tools/generate_index.py

Python files are parsed with `ast` (accurate). TypeScript/TSX files are parsed
with regexes (approximate but sufficient for an index).
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "INDEX.md"

EXCLUDE_DIRS = {
    "node_modules", ".venv", ".git", "__pycache__", "coverage", "coverage_html",
    ".mongo-data", ".expo", "dist", "build", ".pytest_cache", "lcov-report",
    "generated-reports", "uploaded-reports", "assets", ".claude", ".cursor",
}

#: Ordered sections. Each is (heading, blurb, path predicate).
SECTIONS: list[tuple[str, str, str]] = [
    ("Research pipeline", "The rebuilt, leakage-controlled experiment. This is the part a "
     "reviewer should read.", "research"),
    ("Backend — FastAPI", "The deployed clinical decision support API.", "backend"),
    ("Backend — Express", "Node API layer sitting in front of the FastAPI service.", "express"),
    ("Frontend — Expo/React Native", "The clinician and patient mobile app.", "frontend"),
    ("Tooling", "Scripts that maintain the repo itself.", "tools"),
]

RESEARCH_DIRS = {"knowledge_graph", "models", "experiments", "evaluation", "tests", "ontology"}


@dataclass
class Symbol:
    kind: str          # "class" | "func" | "const" | "route"
    name: str
    signature: str = ""
    doc: str = ""
    children: list["Symbol"] = field(default_factory=list)


@dataclass
class FileEntry:
    path: str
    summary: str
    symbols: list[Symbol]
    loc: int


def _first_sentence(text: str | None, limit: int = 160) -> str:
    if not text:
        return ""
    flat = " ".join(text.strip().split())
    for stop in (". ", ".\n"):
        if stop in flat:
            flat = flat.split(stop)[0] + "."
            break
    return flat[:limit].rstrip()


def _sig(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    args = [a.arg for a in node.args.args if a.arg not in ("self", "cls")]
    if node.args.vararg:
        args.append("*" + node.args.vararg.arg)
    if node.args.kwarg:
        args.append("**" + node.args.kwarg.arg)
    return f"({', '.join(args)})"


def parse_python(path: Path) -> FileEntry:
    src = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(REPO).as_posix()
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return FileEntry(rel, "(unparseable)", [], len(src.splitlines()))

    symbols: list[Symbol] = []
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            methods = [
                Symbol("func", m.name, _sig(m), _first_sentence(ast.get_docstring(m), 90))
                for m in node.body
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))
                and not m.name.startswith("__")
            ]
            symbols.append(Symbol("class", node.name, "",
                                  _first_sentence(ast.get_docstring(node), 110), methods))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            symbols.append(Symbol("func", node.name, _sig(node),
                                  _first_sentence(ast.get_docstring(node), 110)))
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id.isupper() and len(t.id) > 2:
                    symbols.append(Symbol("const", t.id))

    # FastAPI endpoints are decorators, not detectable from the AST body walk above
    for m in FASTAPI_ROUTE_RE.finditer(src):
        symbols.append(Symbol("route", f"{m.group(1).upper()} {m.group(2)}"))

    return FileEntry(rel, _first_sentence(ast.get_docstring(tree)), symbols,
                     len(src.splitlines()))


TS_PATTERNS = [
    ("func", re.compile(r"^export\s+(?:async\s+)?function\s+(\w+)", re.M)),
    ("const", re.compile(r"^export\s+const\s+(\w+)", re.M)),
    ("class", re.compile(r"^export\s+(?:default\s+)?class\s+(\w+)", re.M)),
    ("type", re.compile(r"^export\s+(?:interface|type)\s+(\w+)", re.M)),
]
ROUTE_RE = re.compile(r"router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)", re.I)
FASTAPI_ROUTE_RE = re.compile(r"@router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)", re.I)


def parse_ts(path: Path) -> FileEntry:
    src = path.read_text(encoding="utf-8", errors="replace")
    rel = path.relative_to(REPO).as_posix()
    symbols: list[Symbol] = []
    for kind, pat in TS_PATTERNS:
        for m in pat.finditer(src):
            symbols.append(Symbol(kind, m.group(1)))
    for m in ROUTE_RE.finditer(src):
        symbols.append(Symbol("route", f"{m.group(1).upper()} {m.group(2)}"))

    doc = ""
    head = re.match(r"\s*/\*\*(.*?)\*/", src, re.S)
    if head:
        doc = _first_sentence(re.sub(r"^\s*\*\s?", "", head.group(1), flags=re.M))
    return FileEntry(rel, doc, symbols, len(src.splitlines()))


def section_for(rel: str) -> str:
    top = rel.split("/")[0]
    if top in RESEARCH_DIRS:
        return "research"
    if top == "tools":
        return "tools"
    if top == "backend":
        return "backend"
    if top == "express-backend":
        return "express"
    if top == "frontend":
        return "frontend"
    return ""


def collect() -> dict[str, list[FileEntry]]:
    buckets: dict[str, list[FileEntry]] = {k: [] for _, _, k in SECTIONS}
    for path in sorted(REPO.rglob("*")):
        if not path.is_file():
            continue
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        if path.suffix not in {".py", ".ts", ".tsx"}:
            continue
        rel = path.relative_to(REPO).as_posix()
        sec = section_for(rel)
        if not sec:
            continue
        entry = parse_python(path) if path.suffix == ".py" else parse_ts(path)
        if path.name == "__init__.py" and not entry.symbols and not entry.summary:
            continue
        buckets[sec].append(entry)
    return buckets


def render(buckets: dict[str, list[FileEntry]]) -> str:
    total = sum(len(v) for v in buckets.values())
    loc = sum(e.loc for v in buckets.values() for e in v)

    out: list[str] = [
        "# Repository Index",
        "",
        "_Auto-generated by `tools/generate_index.py`. Do not edit by hand — "
        "regenerate after structural changes._",
        "",
        f"**{total} source files · {loc:,} lines**",
        "",
        "| Section | Files | Lines |",
        "|---|---:|---:|",
    ]
    for heading, _, key in SECTIONS:
        files = buckets[key]
        if files:
            out.append(f"| [{heading}](#{heading.lower().replace(' — ', '--').replace(' ', '-').replace('/', '')}) "
                       f"| {len(files)} | {sum(e.loc for e in files):,} |")
    out.append("")

    for heading, blurb, key in SECTIONS:
        files = buckets[key]
        if not files:
            continue
        out += ["---", "", f"## {heading}", "", f"_{blurb}_", ""]
        current_dir = None
        for e in files:
            d = Path(e.path).parent.as_posix()
            if d != current_dir:
                current_dir = d
                out += [f"### `{d}/`", ""]
            out.append(f"**`{Path(e.path).name}`** — {e.summary or '_no module docstring_'}  ")
            out.append(f"<sub>{e.path} · {e.loc} lines</sub>")
            out.append("")
            if e.symbols:
                for s in e.symbols:
                    if s.kind == "class":
                        out.append(f"- **class `{s.name}`** — {s.doc}" if s.doc
                                   else f"- **class `{s.name}`**")
                        for m in s.children:
                            out.append(f"  - `{m.name}{m.signature}` {('— ' + m.doc) if m.doc else ''}")
                    elif s.kind == "func":
                        out.append(f"- `{s.name}{s.signature}` {('— ' + s.doc) if s.doc else ''}")
                    elif s.kind == "route":
                        out.append(f"- route `{s.name}`")
                consts = [s.name for s in e.symbols if s.kind in ("const", "type")]
                if consts:
                    out.append(f"- _exports:_ {', '.join(f'`{c}`' for c in consts[:14])}"
                               + (" …" if len(consts) > 14 else ""))
                out.append("")
    return "\n".join(out) + "\n"


def main() -> int:
    buckets = collect()
    OUT.write_text(render(buckets), encoding="utf-8")
    total = sum(len(v) for v in buckets.values())
    print(f"wrote {OUT.relative_to(REPO)} covering {total} files")
    for heading, _, key in SECTIONS:
        if buckets[key]:
            print(f"  {heading:32s} {len(buckets[key]):>4} files  "
                  f"{sum(e.loc for e in buckets[key]):>7,} lines")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
