# CaseRoom interface design system

Visual references: `../design/practice-concept.png`, `../design/reflection-concept.png`.

- Canvas: true white `#fff`; text navy `#07132e`; muted text `#5a6475`; lines `#d8dce0`; teal action `#117d72`.
- UI font: Inter with system sans fallback. Heading 46/1.12 desktop, 34/1.15 mobile; section heading 28/1.2; body 18/1.55; controls 17/1.2.
- Header: white 74px bar with wordmark, Practice link, and How it works button; no extra badges.
- Practice: outer margin 24px; two outlined panels, 42:58 ratio, 18px gap. Left contains title, introduction, partner briefing, focus list. Right centers code-native wave motif, state, timer, and primary action.
- Reflection: title and subtitle over a 60:40 transcript/reflection split; five skill prompts separated by fine horizontal rules. No fake score, pass/fail result, or audio replay control.
- Responsive: one-column panels under 900px; reading and action order preserved. At narrow widths reduce heading sizes, panel padding and waveform scale.
- Interactive states: ready, connecting, live, error, reflection. The design images show ready/reflection; live uses the same right-panel geometry with session status and transcript preview.
- Above-fold copy: CaseRoom; Practice; How it works; Client interview practice; the short introduction; Partner briefing; Practice area; Client; Situation; Your focus; Ready to begin; Start interview; microphone helper; footer disclaimer.
