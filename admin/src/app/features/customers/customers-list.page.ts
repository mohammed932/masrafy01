import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { PageHeaderComponent } from '@shared/ui';
import {
  CustomersApiService,
  type CustomerListRow,
} from './customers.api.service';

/**
 * Admin Customers — list of end-users who signed up via the mobile app.
 * Read-only; detail drawer + management actions arrive in a follow-up PR
 * once mobile customers are flowing through the system.
 */
@Component({
  selector: 'app-customers-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
    NzEmptyModule,
    NzSpinModule,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header
      i18n-title="@@customers.title"
      title="Customers"
      i18n-subtitle="@@customers.subtitle"
      subtitle="Mobile end-users who signed up for the Masrafy app."
    ></app-page-header>

    <div class="search-row">
      <nz-input-group nzPrefixIcon="search" style="max-width: 360px;">
        <input
          nz-input
          [ngModel]="q()"
          (ngModelChange)="onSearch($event)"
          i18n-placeholder="@@customers.search.placeholder"
          placeholder="Search phone, email, or name"
          autocomplete="off"
        />
      </nz-input-group>
    </div>

    <nz-spin [nzSpinning]="loading()">
      <nz-table
        [nzData]="rows()"
        [nzPageSize]="pageSize"
        [nzPageIndex]="pageIndex() + 1"
        [nzTotal]="total()"
        [nzShowSizeChanger]="false"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="onPageChange($event)"
        [nzNoResult]="emptyTpl"
      >
        <thead>
          <tr>
            <th i18n="@@customers.col.name">Name</th>
            <th i18n="@@customers.col.phone">Phone</th>
            <th i18n="@@customers.col.email">Email</th>
            <th i18n="@@customers.col.applications">Applications</th>
            <th i18n="@@customers.col.verified">Status</th>
            <th i18n="@@customers.col.created">Joined</th>
            <th i18n="@@customers.col.lastLogin">Last login</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr>
              <td>{{ row.name }}</td>
              <td><code>{{ row.phone }}</code></td>
              <td>{{ row.email ?? '—' }}</td>
              <td>{{ row.applicationCount }}</td>
              <td>
                @if (row.isVerified) {
                  <nz-tag nzColor="green" i18n="@@customers.status.verified">Verified</nz-tag>
                } @else {
                  <nz-tag nzColor="default" i18n="@@customers.status.unverified">Unverified</nz-tag>
                }
                @if (!row.isActive) {
                  <nz-tag nzColor="red" i18n="@@customers.status.inactive">Inactive</nz-tag>
                }
              </td>
              <td>{{ row.createdAt | date: 'mediumDate' }}</td>
              <td>{{ row.lastLoginAt ? (row.lastLoginAt | date: 'short') : '—' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      <ng-template #emptyTpl>
        <nz-empty
          i18n-nzNotFoundContent="@@customers.empty"
          nzNotFoundContent="No customers yet — mobile signups will appear here."
        ></nz-empty>
      </ng-template>
    </nz-spin>
  `,
  styles: [
    `
      .search-row {
        margin: 16px 0;
      }
      code {
        font-family: var(--font-mono, monospace);
      }
    `,
  ],
})
export class CustomersListPage implements OnInit {
  private readonly api = inject(CustomersApiService);

  protected readonly q = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly rows = signal<CustomerListRow[]>([]);
  protected readonly pageSize = 25;

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.load();
  }

  onSearch(value: string): void {
    this.q.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.pageIndex.set(0);
      void this.load();
    }, 250);
  }

  onPageChange(oneBasedIndex: number): void {
    this.pageIndex.set(Math.max(oneBasedIndex - 1, 0));
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.api.list({
        q: this.q(),
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize,
      });
      this.rows.set(result.data);
      this.total.set(result.pagination.total);
    } finally {
      this.loading.set(false);
    }
  }
}
