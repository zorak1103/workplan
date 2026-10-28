# Bug Analysis: <Short description of the defect>

<Ticket + branch, affected component.>

> [!NOTE]
> Line numbers in this document reflect the state at the time of analysis and drift with
> every restructuring. Always navigate by method name / symbol search, never jump blindly to a
> line.

## Symptom

<Observed misbehavior from the user's or a test's point of view — no cause, only observation.>

## Root Cause

<The actual cause, verified in the code. File and method references instead of line numbers.>

## Evidence Chain (Call Chain)

<Step by step from the trigger to the root cause, with file/method references. Every step must
have been traced in the code, not assumed.>

## Reproduction

<Concrete steps or inputs that trigger the defect.>

## Red Reproduction Tests

<Test(s) that prove the defect (red as long as the fix is missing). File + test name.>

<a id="fix-sketch"></a>
## Fix Sketch for the Follow-up Session (not part of this session)

<Sketch of the fix — approach, affected files, open questions. If needed, it is turned into a
workplan via `/workplan:create --from-bug <this document>`, which makes Phase 0/1 out of this
sketch.>
