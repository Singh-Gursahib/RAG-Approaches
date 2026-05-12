# Manual grading review — `sliding_window_20260512_004119_9480ef`

Auto-grades shown; if you disagree, edit the `correct` column on a line and the agent will reconcile (and grep-verify) when prompted.

| QID | Type | Gold | Prediction | Auto EM | Auto F1 | Correct? |
|---|---|---|---|---|---|---|
| `needle-01` | needle | MULBERRY-7Q | MULBERRY-7Q | 1 | 1.00 | ✓ |
| `needle-02` | needle | 0.46 ppm | 0.46 ppm | 1 | 1.00 | ✓ |
| `needle-03` | needle | M7-RX-204-A | M7-RX-204-A | 1 | 1.00 | ✓ |
| `needle-04` | needle | 4.832 GHz | 4.832 GHz | 1 | 1.00 | ✓ |
| `needle-05` | needle | 12% | 12% | 1 | 1.00 | ✓ |
| `needle-06` | needle | 178 | 178 | 1 | 1.00 | ✓ |
| `needle-07` | needle | 7 years | seven years | 0 | 0.50 | ✗ |
| `needle-08` | needle | 14.5 | 14.5 degrees Celsius | 0 | 0.50 | ✗ |
| `hop-01` | multi_hop | Veridian | Veridian | 1 | 1.00 | ✓ |
| `hop-02` | multi_hop | Quentin Aldermann | Quentin Aldermann | 1 | 1.00 | ✓ |
| `hop-03` | multi_hop | Halden Institute for Computational Mycology | Halden Institute for Computational Mycology | 1 | 1.00 | ✓ |
| `hop-04` | multi_hop | Auralite Accord | Article 7-bis of the Auralite Accord | 0 | 0.50 | ✗ |
| `hop-05` | multi_hop | 1991, Veridian Heights | 1991, Veridian Heights | 1 | 1.00 | ✓ |
| `hop-06` | multi_hop | Iola Penmarrick | Ambassador Iola Penmarrick | 0 | 0.80 | ✗ |
| `hop-07` | multi_hop | 32 years | 32 years old | 0 | 0.80 | ✗ |
| `hop-08` | multi_hop | 542 km | 542 | 0 | 0.67 | ✗ |
| `dist-01` | distractor | 2019 | 2019 | 1 | 1.00 | ✓ |
| `dist-02` | distractor | Mei-Ling Forrester | Dr. Mei-Ling Forrester | 0 | 0.86 | ✗ |
| `dist-03` | distractor | 25 years | twenty-five years | 0 | 0.40 | ✗ |
| `dist-04` | distractor | 2,847,000 | 2,847,000 | 1 | 1.00 | ✓ |
| `dist-05` | distractor | 4.2 kilowatts | 4.2 kilowatts | 1 | 1.00 | ✓ |
| `dist-06` | distractor | 1932 | 1932 | 1 | 1.00 | ✓ |
| `dist-07` | distractor | $47.3 million | $47.3 million USD | 0 | 0.80 | ✗ |
| `dist-08` | distractor | Henrik Voss | Dr. Henrik Voss | 0 | 0.80 | ✗ |
| `halluc-01` | hallucination | NOT_IN_CORPUS | NOT_IN_CONTEXT | 1 | 1.00 | ✓ |
| `halluc-02` | hallucination | NOT_IN_CORPUS | NOT_IN_CONTEXT | 1 | 1.00 | ✓ |
| `halluc-03` | hallucination | NOT_IN_CORPUS | NOT_IN_CONTEXT | 1 | 1.00 | ✓ |
| `halluc-04` | hallucination | NOT_IN_CORPUS | NOT_IN_CONTEXT | 1 | 1.00 | ✓ |
| `halluc-05` | hallucination | NOT_IN_CORPUS | NOT_IN_CONTEXT | 1 | 1.00 | ✓ |
| `halluc-06` | hallucination | NOT_IN_CORPUS | NOT_IN_CONTEXT | 1 | 1.00 | ✓ |
| `sanity-01` | sanity | 1991 | 1991 | 1 | 1.00 | ✓ |
| `sanity-02` | sanity | Quentin Aldermann | Quentin Aldermann | 1 | 1.00 | ✓ |
| `sanity-03` | sanity | 9 April 2019 | 9 April 2019 | 1 | 1.00 | ✓ |
| `sanity-04` | sanity | 14 November 1987 | 14 November 1987 | 1 | 1.00 | ✓ |

**Auto-grade total: 24/34 correct (70.6%).**