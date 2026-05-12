import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopBarComponent } from './top-bar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, TopBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar />
    <main class="shell-main">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        background: var(--color-surface-elevated);
      }
      .shell-main {
        flex: 1;
        padding-block: var(--space-5);
        padding-inline: var(--space-5);
      }
    `,
  ],
})
export class ShellComponent {}
