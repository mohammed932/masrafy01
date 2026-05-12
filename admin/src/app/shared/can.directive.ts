import {
  Directive,
  EmbeddedViewRef,
  Input,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import type { StaffRole } from '@core/auth/auth.types';

/**
 * Structural directive `*can="['SUPER_ADMIN']"` — renders the content only when
 * the current user's role is in the allowed set. Drives FR-013 hide/disable of
 * write controls across the dashboard. Use on buttons, links, or any wrapper
 * element; do NOT use to gate ACTUAL permission checks — RolesGuard on the
 * backend is the source of truth.
 *
 * Constitution Principle XIX: structural directives generally a review block;
 * this one is allowed because (a) it is the canonical way to express "render
 * if role matches" without polluting every template with @if (auth.role()…),
 * (b) it is project-defined, not third-party, and (c) it is unit-tested.
 */
@Directive({
  selector: '[can]',
  standalone: true,
})
export class CanDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vc = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  private readonly allowed = computed(() => this._allowed());
  private _allowed: () => ReadonlyArray<StaffRole> = () => [];
  private view: EmbeddedViewRef<unknown> | null = null;

  @Input({ required: true })
  set can(roles: ReadonlyArray<StaffRole>) {
    this._allowed = () => roles;
  }

  constructor() {
    effect(() => {
      const role = this.auth.role();
      const ok = role !== null && this.allowed().includes(role);
      if (ok && !this.view) {
        this.view = this.vc.createEmbeddedView(this.tpl);
      } else if (!ok && this.view) {
        this.vc.clear();
        this.view = null;
      }
    });
  }
}
