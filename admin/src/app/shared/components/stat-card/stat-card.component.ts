import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';

export type StatTrend = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [NgClass, NzIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  readonly title = input<string>('');
  readonly value = input<string>('');
  readonly trend = input<StatTrend>('neutral');
  readonly subtext = input<string>('');
}
