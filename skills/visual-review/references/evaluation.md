# Evaluate on real patches

The examples are teaching material, not an executed evaluation suite. Evaluate the skill on actual repositories before making effectiveness claims.

## Start with three patches

Choose one small boundary-condition change, one cross-file behavioral change, and one intended pure refactor. Record exact base/head revisions. Do not choose only changes whose intended interpretation is already obvious to the agent.

For each patch:
1. Have a human inspect the diff and relevant context to create a private reference: observed deltas, affected paths, important uncertainty, and priority review locations.
2. Run visual-review without showing that reference to the agent. Record the model, skill version, scope, and output.
3. Check the output against source and the reference. If practical, compare with an ordinary textual explanation using equivalent context.
4. Ask a reviewer to identify the changed behavior and the first code locations they would inspect. Record errors and source-navigation effort; measure review time if useful, but do not treat speed alone as success.
5. Revise the skill based on concrete mistakes. Re-run after changes; do not add a rule merely because it sounds desirable.

## Checklist

- Scope and omissions are explicit, with correct base/head.
- Claimed behavioral changes are supported by actual before/after source.
- Nodes and edges are verified; arrows have unambiguous meanings.
- Evidence anchors resolve to the correct revision and relevant code.
- Unchanged but affected code is included when needed.
- Intent/inference is separated from observation.
- A local predicate change does not become a decorative diagram.
- A refactor does not receive unproven behavior-preservation claims.
- Concrete review questions point to scenarios and source.
- Test existence, assertion coverage, and execution are distinguished.
- Output is small enough to serve as a navigation aid.

Unsupported factual claims, wrong source anchors, or false reports of test execution are blocking failures regardless of visual quality. Track missed important impacts separately from stylistic issues. Do not assign a fabricated confidence/risk number to compensate for missing evidence.
