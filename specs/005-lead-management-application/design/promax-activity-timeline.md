# promax — Activity Timeline Component

Pre-design pass for the chronological history view on the detail page (FR-013, FR-024).

## Pattern

Vertical list with rail. Each entry is a "card-less" row to avoid card-in-card nesting
(the detail page is already inside a card surface).

```
●  Called user · Initial contact                       2 min ago · Agent A
│  «Note body, two-line clamp, click row to expand…»
│  Duration 12 min · Outcome: User confirmed · Follow-up tomorrow 10:00 AM
│
●  Received documents · Via WhatsApp                  18 min ago · Agent A
│  Attachments: passport.jpg, bank-stmt.pdf, payslip.pdf
│
●  Lead reassigned · Workload rebalance               1 hr ago · Manager B
│  Manager B → Agent A
│
●  Application created                                 yesterday 14:32 · System
```

## Filter chip row (above list)

```
[ All ] [ Calls (4) ] [ Messages (8) ] [ Documents (3) ] [ System (2) ]
                                                       Search [_______]
```

Chips serialize to URL `?activityFilter=`.

## Style

- Rail color = `--color-border-default`; activity-dot color tinted per category (call=info, msg=tonal, doc=success, system=tertiary). Color + icon, never color alone.
- Row hover `--color-surface-row-hover`. Click expands; expand area uses `@defer`.
- Note clamped with `display: -webkit-box; -webkit-line-clamp: 2`.
- Date "2 min ago" tooltip shows absolute timestamp via `<time datetime>`.

## Accessibility

- Each row is a `<li>`; rail is decorative `aria-hidden`.
- Expandable row uses `aria-expanded`; collapsed content not focusable (`hidden` attr or `inert`).
- Color-blind safe: icon + label always paired.

## Performance

- Cursor pagination, 25 entries per page; infinite scroll uses `IntersectionObserver`.
- Activity list 200 entries deep — p95 read < 200 ms (covered by `idx_activity_application_occurred`).
