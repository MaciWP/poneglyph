# Critic precision audit (2026-11-11)

Sample: 34 of 244 findings delivered between 2026-11-10 09:30 and 2026-11-11 09:00, seeded shuffle
(seed 20261111): 15 minor, 15 major, and 4 picked from BLOCK reviews or disputed answers (reported
apart, not pooled). Three Sonnet agents checked each finding against its repository, read-only.
Deviation from the plan, which had the Lead audit by hand: the user asked for agents to help score.

| Stratum | Real | Debatable | False positive | Unverifiable |
|---|---|---|---|---|
| Minor (15) | 11 | 1 | 0 | 3 |
| Major (15) | 11 | 2 | 0 | 2 |
| Selected (4) | 4 | 0 | 0 | 0 |

- Verifiable random findings: 27. False positives 0/27; 95 % Wilson upper bound about 12 %.
- Debatable: 3/27 (a documented test coupling, a heading wording, a mostly covered dump risk).
- Unverifiable: 5 findings on plans in `~/agentic-os-scratch`, now empty.
- The Lead accepted 32 of 34; 2 stayed unanswered in workboard sessions, where no gate applied.

Limits:
- The inmo-suite repository has a single commit. 12 of its 16 findings were judged from the fix
  visible in the current tree, which is circular when the Lead applied the fix. Only 4 were checked
  directly against the code.
- The auditors are models. The 3 debatable findings are open for the user to settle.

Reading: no sign of over-criticism. The high acceptance rate is consistent with the findings being
real: 169 accepted and 5 disputed of 174 answered with a choice, counting each answer only before the
next review. The earlier 198 of 203 matched a later review's rows. The 102 unanswered are mostly
answers without a choice cell (`| H1: claim | fix |`), written before the gate read them. The ">30 % false positives in a category" trigger does not fire.
Repeat the audit after a prompt change or when disputes rise.

Side finding: `critic-report.ts` matched an earlier review's `| H1 |` against a later review's
rows (entry 31). Answers are now bounded to the text before the next review.
