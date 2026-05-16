import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzMessageModule, NzMessageService } from 'ng-zorro-antd/message';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { CheckCircleOutline } from '@ant-design/icons-angular/icons';

interface Row {
  readonly id: number;
  readonly name: string;
  readonly role: string;
}

// Throwaway verification route. Confirms NG-ZORRO Less theme compiled with
// brand primary #06152D, locale provider works in LTR/RTL builds, and core
// modules (button, table, message, icon) bootstrap. Deleted in PR 2.
@Component({
  selector: 'app-nz-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NzButtonModule, NzTableModule, NzMessageModule, NzIconModule],
  providers: [provideNzIconsPatch([CheckCircleOutline])],
  template: `
    <section class="page nz-demo">
      <h1>NG-ZORRO verification</h1>

      <div class="row">
        <button nz-button nzType="primary" (click)="ping()">
          <span nz-icon nzType="check-circle" nzTheme="outline"></span>
          Primary (should be #06152D)
        </button>
        <button nz-button>Default</button>
        <button nz-button nzType="dashed">Dashed</button>
        <button nz-button nzDanger>Danger</button>
      </div>

      <nz-table #t [nzData]="rows" nzBordered>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          @for (r of t.data; track r.id) {
            <tr>
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.role }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </section>
  `,
  styles: [
    `
      .nz-demo {
        padding: var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      .row {
        display: flex;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
    `,
  ],
})
export class NzDemoPage {
  private readonly message = inject(NzMessageService);

  protected readonly rows: Row[] = [
    { id: 1, name: 'Acme Bank', role: 'partner' },
    { id: 2, name: 'River Capital', role: 'partner' },
    { id: 3, name: 'Cedar Loans', role: 'partner' },
  ];

  protected ping(): void {
    this.message.success('NG-ZORRO is wired up.');
  }
}
