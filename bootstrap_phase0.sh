#!/usr/bin/env bash
# Phase 0 bootstrap for the HealthSage research rebuild.
#
#   bash bootstrap_phase0.sh
#
# Idempotent. Makes NO git commits and NO pushes.
# See ../HEALTHSAGE_AUDIT_AND_PLAN.md for why each step exists.

set -euo pipefail

REPO_URL="https://github.com/Zayyam-Hassan/HealthSage-FYP"
PY="./.venv/Scripts/python.exe"     # Windows layout; use .venv/bin/python on macOS/Linux
[ -x "$PY" ] || PY="./.venv/bin/python"

echo "=== HealthSage Phase 0 bootstrap ==="

# ---------------------------------------------------------------------------
# 1. Git init + remote
#    The folder was not git-tracked, though its contents are byte-identical to
#    origin/APK_Implementation (CRLF vs LF only). autocrlf keeps that true.
# ---------------------------------------------------------------------------
if [ ! -d .git ]; then
  echo "[1/6] git init"
  git init -q
  git remote add origin "$REPO_URL"
  git config core.autocrlf true
else
  echo "[1/6] git already initialised"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "$REPO_URL"
fi

# ---------------------------------------------------------------------------
# 2. .gitignore
#    The original ignored "*.md" — which would have excluded every README and
#    the audit document itself.
# ---------------------------------------------------------------------------
echo "[2/6] .gitignore"
if grep -qx '\*\.md' .gitignore; then
  grep -vx '\*\.md' .gitignore > .gitignore.tmp && mv .gitignore.tmp .gitignore
  echo "      removed blanket '*.md' ignore"
fi
if ! grep -q '^# Research pipeline outputs' .gitignore; then
  cat >> .gitignore <<'EOF'

# Research pipeline outputs (regenerable via `make repro-full`)
data/cohorts/
data/graphs/
data/artifacts/
research/**/__pycache__/

# Python venv
.venv/

# Should never have been committed
express-backend/.mongo-data/
express-backend/coverage/
express-backend/generated-reports/
express-backend/uploaded-reports/
backend/coverage.xml
EOF
  echo "      appended research + hygiene entries"
fi

# ---------------------------------------------------------------------------
# 3. Untrack artifacts that pollute the repo (no-op if never tracked)
# ---------------------------------------------------------------------------
echo "[3/6] untracking committed artifacts"
for p in express-backend/.mongo-data express-backend/coverage backend/coverage.xml; do
  git rm -r --cached --ignore-unmatch -q "$p" 2>/dev/null || true
done

# ---------------------------------------------------------------------------
# 4. Python venv + dependencies
#    A clean venv, not --system-site-packages: reproducibility is a stated goal
#    of this rebuild, and `make repro-full` must work for a stranger.
# ---------------------------------------------------------------------------
echo "[4/6] python venv"
if [ ! -d .venv ]; then
  python -m venv .venv
  echo "      created .venv"
else
  echo "      .venv already exists"
fi
[ -x "./.venv/Scripts/python.exe" ] && PY="./.venv/Scripts/python.exe" || PY="./.venv/bin/python"

"$PY" -m pip install --quiet --disable-pip-version-check --upgrade pip setuptools wheel
"$PY" -m pip install --quiet --disable-pip-version-check -r backend/requirements.txt
# xgboost = classical baseline; shap = explainability comparison; pyarrow = cohort parquet I/O
"$PY" -m pip install --quiet --disable-pip-version-check xgboost shap pyarrow
echo "      dependencies installed"

# ---------------------------------------------------------------------------
# 5. Node dependencies
# ---------------------------------------------------------------------------
echo "[5/6] node dependencies"
for p in express-backend frontend; do
  if [ -d "$p/node_modules" ]; then
    echo "      $p: node_modules present - skipping"
  else
    echo "      $p: npm install"
    (cd "$p" && npm install --no-audit --no-fund --silent)
  fi
done

# ---------------------------------------------------------------------------
# 6. Scaffold the research package
# ---------------------------------------------------------------------------
echo "[6/6] scaffolding research/ and tests/research/"
mkdir -p research/{data,graph,models,eval,experiments,configs} \
         tests/research \
         data/{cohorts,graphs,artifacts}
for d in research research/data research/graph research/models research/eval \
         research/experiments tests tests/research; do
  [ -f "$d/__init__.py" ] || : > "$d/__init__.py"
done

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
echo
echo "=== verification ==="
"$PY" - <<'PY'
import importlib, sys
print("python", sys.version.split()[0], "|", sys.prefix)
bad = []
for m in ["torch","torch_geometric","rdflib","sklearn","pandas","numpy","scipy",
          "xgboost","shap","pyarrow","matplotlib","fastapi","pymongo","pytest"]:
    try:
        print(f"  OK   {m:18s} {getattr(importlib.import_module(m),'__version__','n/a')}")
    except Exception as e:
        bad.append(m); print(f"  FAIL {m:18s} {e}")
import torch
from torch_geometric.nn import SAGEConv, HGTConv, RGCNConv, HeteroConv  # noqa: F401
print(f"  torch cuda: {torch.cuda.is_available()} | threads: {torch.get_num_threads()}")
sys.exit(1 if bad else 0)
PY

echo
echo "=== Phase 0 complete ==="
echo
echo "Activate the venv with:"
echo "    source .venv/Scripts/activate      # Git Bash on Windows"
echo "    .\\.venv\\Scripts\\Activate.ps1        # PowerShell"
echo
echo "Then create the working branch and baseline commit:"
echo "    git checkout -b research/rebuild"
echo "    git add -A && git commit -m 'baseline: pre-rebuild state'"
echo
echo "Next: Phase A1 - research/data/build_cohorts.py"
