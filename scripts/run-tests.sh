#!/usr/bin/env bash
# Run this repo's test suite.
#
# Exists so the PR review loop's test gate can find it. The gate discovers a
# command from the repo ROOT, and there is no package.json here - the suite
# lives in backend/ - so without this the gate reports "no test command found"
# and every review pass renders NO TESTS RAN. That is a different claim from
# "the tests passed", and 474 passing tests reading as a repo with none is
# worse than having no gate.
#
# `vitest run`, not `vitest`: the bare command watches and never exits, so the
# gate would hang instead of returning a verdict.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)/backend"
exec npx vitest run
