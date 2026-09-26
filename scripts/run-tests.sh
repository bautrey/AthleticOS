#!/usr/bin/env bash
# Run this repo's test suite.
#
# Exists so the PR review loop's test gate can find it: the gate discovers a
# command from the repo ROOT, and there is no package.json here - the suite
# lives in backend/. Without this the gate reports "no test command found" and
# every review pass renders NO TESTS RAN, which is a different claim from "the
# tests passed" and reads worse than no gate at all.
#
# Lives in scripts/ rather than .claude/, which this repo gitignores. An
# ignored file cannot reach the detached worktree the reviewers read.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/backend"

# CANNOT-MEASURE vs FAILED. The review loop reviews a detached worktree at the
# PR head, and a fresh checkout has no node_modules and no .env, because both
# are gitignored. Running anyway exits non-zero for reasons that have nothing
# to do with the code, and the gate would report a CRITICAL red suite on every
# pass forever - a permanent false alarm that trains everyone to ignore it.
#
# The gate treats exit 125 as unmeasurable ONLY when this exact sentinel is on
# the output, because 125 is also a legitimate failure count from some test
# harnesses. Print it and exit 125; do not print it and exit 125 and you get
# the false CRITICAL this guard exists to prevent.
cannot_measure() {
  echo "LOOP-TEST-GATE: CANNOT-MEASURE"
  echo "$1"
  exit 125
}

[ -d node_modules/vitest ] || cannot_measure \
  "backend/node_modules is absent (gitignored), so the runner is not installed here. Run 'npm ci' in backend/ to measure."

# The suite talks to a real database by this project's NO MOCKS policy, so
# without a connection string the DB-backed files fail for an environment
# reason rather than a code one.
if [ -z "${DATABASE_URL:-}" ] && ! grep -qs '^DATABASE_URL=.' .env; then
  cannot_measure "no DATABASE_URL in the environment or backend/.env, and this suite uses a real database."
fi

exec npx vitest run
