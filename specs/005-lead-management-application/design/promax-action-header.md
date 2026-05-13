# promax — Application Detail Action Header

Pre-design pass for the **sole action surface** per FR-010a..FR-010d. Inherits the
admin design system.

## Pattern

Sticky header below the breadcrumb. Two rows.

```
┌─ Application #{shortId}  ▸ leadStatus chip  ▸ assigned: Agent A ─┐
│                                                                   │
│ [+ Add Activity]  [📎 Attach Documents]  [⤴ Mark Ready]           │
│                                                                   │
│                                       [⋮ More Actions ▾]          │
└───────────────────────────────────────────────────────────────────┘
```

Primary row (4 CTAs visible by role permission):

| CTA | Visible when | Role |
|---|---|---|
| `+ Add Activity` | always (user has write role) | super_admin, sales_manager, sales_agent |
| `📎 Attach Documents` | always — opens Add Activity scoped to `RECEIVED_DOCUMENTS` | same |
| `Assign / Reassign` | always | super_admin, sales_manager |
| `Mark Ready for Bank` | `leadStatus = document_collection` AND ≥ 1 verified doc | same writes |

Overflow menu (`⋮ More Actions`):

- Add Internal Note
- Request More Documents
- Mark as Reviewed
- Submitted to Bank
- Bank Responded
- Update Applicant Info

## Style

- Header row inset padding `var(--space-5)` block, `var(--space-6)` inline.
- Buttons gap `var(--space-3)`. Primary CTA filled brand; secondary outlined; overflow ghost-icon.
- Sticky `position: sticky; top: var(--topbar-height);` + 1px bottom border `--color-border-default` on scroll.
- Status chip uses semantic palette per leadStatus value.

## Accessibility

- Each button: text + aria-label (the icons alone fail SR).
- Menu trigger: `aria-haspopup="menu"`, `aria-expanded` bound.
- All buttons ≥ 44×44 touch target (mobile breakpoint).

## Anti-patterns

- Putting any action button inline on the list page row — explicitly forbidden by FR-010a.
- Hiding the primary CTA in the overflow menu — keep top-4 visible.
- Mixing routes — the detail page IS the destination; no in-place inline forms.
