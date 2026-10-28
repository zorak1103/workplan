// Shared fixtures for the workplan plugin's tests. `validWorkplanText()` returns a complete,
// convention-conformant Markdown workplan document (two phases, one subphase, one finding, one
// risk) -- the ground truth every round-trip and validation test is checked against. Kept as a
// template literal rather than reading reference/workplan-template.md directly, because the
// template still contains angle-bracket placeholders (deliberately, per document-conventions.md)
// and this fixture needs to be placeholder-free and pass validate-workplan.mjs cleanly.

export function validWorkplanText() {
  return [
    '# Workplan: Example refactoring',
    '',
    'This document is **Workplan 1** under ticket **TEST-1** (branch `TEST-1`).',
    '',
    '> [!NOTE]',
    '> Line numbers in this document reflect the state at the time of analysis and drift with',
    '> every restructuring. Always navigate by method name / symbol search.',
    '',
    '> [!IMPORTANT]',
    '> **The scope of this session is exclusively this planning document.**',
    '',
    '## Phase Overview',
    '',
    '| Phase | Content | Type | Complexity | Status |',
    '|---|---|---|---|---|',
    '| 0 | Create safety net (mandatory) | Implementation | S | Open |',
    '| 1 | Implement core change | Implementation | M | Open |',
    '',
    '## Commit Cut (Proposal)',
    '',
    '| Commit | Phase | Content | Hash |',
    '|---|---|---|---|',
    '| C1 | 0 | Safety net | — |',
    '| C2 | 1 | Core change | — |',
    '',
    '> [!NOTE]',
    '> Proposal. The cut may be revised during execution.',
    '',
    '## Current State',
    '',
    'Example current state for the test.',
    '',
    '## Findings',
    '',
    '### C1 — Example finding',
    '',
    'Verified in the code at Example.java#exampleMethod.',
    '',
    '## Goal',
    '',
    'Example goal.',
    '',
    '## Approach',
    '',
    '### Phase 0 — Create safety net (mandatory)',
    '',
    '- **Goal:** Add characterization tests.',
    '- **Requires:** none',
    '- **Delivers:** ExampleCharacterizationTest',
    '- **Files:** `ExampleCharacterizationTest.java` (new)',
    '- **Complexity:** S — One new test case, no dependencies, solution fully known.',
    '',
    'Work step A.',
    '',
    '### Phase 1 — Implement core change',
    '',
    '- **Goal:** Implement the actual change.',
    '- **Requires:** ExampleCharacterizationTest from phase 0',
    '- **Delivers:** Example.newMethod()',
    '- **Files:** `Example.java` (modify)',
    '- **Complexity:** M — One file, approach clear, verified by existing tests.',
    '',
    'Work step B.',
    '',
    '#### 1.1 — Subphase',
    '',
    'Work step B.1.',
    '',
    '## Out of Scope',
    '',
    'Not part of this workplan: example follow-up work.',
    '',
    '## Risks',
    '',
    '| Risk | Severity | Mitigation |',
    '|---|---|---|',
    '| Example risk | low | Example mitigation |',
    '',
    '## Verification',
    '',
    'Tests run per phase, see the project instructions.',
    '',
    '## Addenda',
    '',
    '',
  ].join('\n');
}

/**
 * A workplan document in an older 4-column table format (no `Complexity` column, no
 * `- **Complexity:**` phase fields). Used only to check that `set-phase-status.mjs` still
 * rewrites such a document correctly (positional-cell regression guard) -- this text is NOT
 * expected to pass `validate-workplan.mjs`, which requires the column.
 */
export function legacyPhaseTableWorkplanText() {
  return validWorkplanText()
    .replace('| Phase | Content | Type | Complexity | Status |\n|---|---|---|---|---|', '| Phase | Content | Type | Status |\n|---|---|---|---|')
    .replace('| 0 | Create safety net (mandatory) | Implementation | S | Open |', '| 0 | Create safety net (mandatory) | Implementation | Open |')
    .replace('| 1 | Implement core change | Implementation | M | Open |', '| 1 | Implement core change | Implementation | Open |')
    .replace('- **Complexity:** S — One new test case, no dependencies, solution fully known.\n', '')
    .replace('- **Complexity:** M — One file, approach clear, verified by existing tests.\n', '');
}

export function validBugText() {
  return [
    '# Bug Analysis: Example defect',
    '',
    'Ticket TEST-2, branch TEST-2.',
    '',
    '## Symptom',
    '',
    'Example symptom.',
    '',
    '## Root Cause',
    '',
    'Example cause in Example.java#exampleMethod.',
    '',
    '## Evidence Chain (Call Chain)',
    '',
    'Step 1 -> Step 2 -> Root Cause.',
    '',
    '## Reproduction',
    '',
    'Example steps.',
    '',
    '## Red Reproduction Tests',
    '',
    'ExampleReproTest#testDefect.',
    '',
    '<a id="fix-sketch"></a>',
    '## Fix Sketch for the Follow-up Session (not part of this session)',
    '',
    'Example sketch.',
    '',
  ].join('\n');
}
