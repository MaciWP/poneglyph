"""Read-only audit inventory and entrypoint coverage check. Python 3 + Git."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DIRECTORIES = (".claude/skills", ".claude/commands", ".claude/hooks")


def verify():
    manifest = json.loads((HERE / "inventory.json").read_text(encoding="utf-8"))
    if manifest.get("redacted_entries"):
        print(json.dumps({
            "status": "not-validated",
            "reason": "The historical public inventory is privacy-redacted. Full originals are in private Work memory. Use the current core source gate; do not claim current coverage from this audit.",
        }, indent=2))
        return 2
    tracked = subprocess.check_output(
        ["git", "ls-tree", "-rz", "--name-only", manifest["base_commit"], "--", *DIRECTORIES],
        cwd=ROOT,
    ).decode("utf-8").rstrip("\0").split("\0")
    entries = manifest["files"]
    paths = [item["path"] for item in entries]
    errors = []
    if len(paths) != len(set(paths)):
        errors.append("Duplicate inventory path")
    if set(paths) != set(tracked):
        errors.append("Inventory does not match all tracked files at base commit")
    for item in entries:
        path = ROOT / item["path"]
        if not path.is_file():
            errors.append("Missing: " + item["path"])
            continue
        # Git blobs avoid false drift from autocrlf checkout conversion on Windows.
        blob = subprocess.check_output(
            ["git", "cat-file", "blob", manifest["base_commit"] + ":" + item["path"]], cwd=ROOT
        )
        if hashlib.sha256(blob).hexdigest() != item["sha256"]:
            errors.append("Base hash mismatch: " + item["path"])
        if len(blob) != item["bytes"] or len(blob.splitlines()) != item["lines"]:
            errors.append("Base size/line mismatch: " + item["path"])
    # Reject changes since the audit base, including staged/unstaged source changes.
    drift = subprocess.check_output(
        ["git", "diff", "--name-only", manifest["base_commit"], "--", *DIRECTORIES], cwd=ROOT
    ).decode("utf-8").strip()
    if drift:
        errors.append("Audited source has changed; re-audit before claiming current coverage: " + drift)
    reports = "\n".join((HERE / name).read_text(encoding="utf-8")
                        for name in ("skills.md", "commands-and-hooks.md"))
    expected = {
        "skill": {Path(p).parent.name for p in tracked if p.endswith("/SKILL.md")},
        "command": {Path(p).stem for p in tracked if Path(p).parent.as_posix() == ".claude/commands" and p.endswith(".md")},
        "hook": {Path(p).stem for p in tracked if Path(p).parent.as_posix() == ".claude/hooks" and p.endswith(".ts")},
        "executable-command": {"sync-claude.ts"},
        "helper": {"hook-stdin"},
    }
    counts = {}
    for kind, names in expected.items():
        found = re.findall(r"<!-- " + re.escape(kind) + r":([^ ]+) -->", reports)
        if set(found) != names or len(found) != len(names):
            errors.append("Missing, extra or duplicate report entry: " + kind)
        counts[kind] = len(found)
    for doc in HERE.glob("*.md"):
        for link in re.findall(r"\]\(([^\s)]+)\)", doc.read_text(encoding="utf-8")):
            target = link.split("#", 1)[0]
            if target and "://" not in target and not (HERE / target).is_file():
                errors.append("Broken local link in " + doc.name + ": " + target)
    result = {"base_commit": manifest["base_commit"], "inventory_files": len(entries),
              "entrypoints": counts, "errors": errors,
              "meaning": "Inventory and report coverage; not semantic completeness or product correctness"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(verify())
