import type { LeavePeriod, ParentRole } from '@shared/types';
import { getLeaveTypeLabel, getParentRoleLabel } from './leavePlanMock';

export interface TimelineMilestone {
  date: string;
  label: string;
  kind: 'event' | 'deadline';
  description: string;
}

export interface TimelineLeavePeriod extends LeavePeriod {
  workTimeFraction?: number;
}

interface LeaveTimelineProps {
  periods: TimelineLeavePeriod[];
  milestones: TimelineMilestone[];
  onSelectDate: (isoDate: string, openDayDetails?: boolean) => void;
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL');
const currencyFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
});

function toEpochDays(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

function formatRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

function formatWorkFraction(fraction: number): string {
  if (fraction === 0.25) return '1/4 etatu';
  if (fraction === 0.5) return '1/2 etatu';
  return `${fraction} etatu`;
}

function getPeriodKindClass(period: TimelineLeavePeriod): string {
  if (period.workTimeFraction) return 'timeline-bar--with-work';
  if (period.leaveType === 'parentalLeave') return 'timeline-bar--parental';
  if (period.leaveType === 'paternityLeave') return 'timeline-bar--paternity';
  return 'timeline-bar--maternity';
}

export function LeaveTimeline({ periods, milestones, onSelectDate }: LeaveTimelineProps) {
  if (periods.length === 0) {
    return (
      <section className="leave-card" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="leave-card__title">
          Oś czasu urlopów
        </h2>
        <p className="leave-card__empty">
          Brak zaplanowanych okresów urlopu. Dodaj część poniżej, aby zobaczyć oś czasu.
        </p>
      </section>
    );
  }

  const allStarts = periods.map((p) => toEpochDays(p.startDate));
  const allEnds = periods.map((p) => toEpochDays(p.endDate));
  const minDay = Math.min(...allStarts);
  const maxDay = Math.max(...allEnds);
  const totalSpan = Math.max(1, maxDay - minDay + 1);

  const roles: ParentRole[] = ['mother', 'father'];

  return (
    <section className="leave-card" aria-labelledby="timeline-heading">
      <div className="leave-card__header">
        <div>
          <h2 id="timeline-heading" className="leave-card__title">
            Oś czasu urlopów (Matka i Ojciec)
          </h2>
          <p className="leave-card__lead">
            Kliknij wybrany okres, aby przejść do niego w kalendarzu miesięcznym poniżej.
          </p>
        </div>
        <div className="timeline-milestones" aria-label="Ważne daty i terminy wniosków">
          {milestones.map((milestone) => (
            <button
              key={`${milestone.date}-${milestone.label}`}
              type="button"
              className={
                milestone.kind === 'deadline'
                  ? 'milestone-chip milestone-chip--deadline'
                  : 'milestone-chip'
              }
              title={milestone.description}
              onClick={() => onSelectDate(milestone.date, true)}
            >
              {milestone.kind === 'deadline' && (
                <span className="milestone-chip__kind">Termin złożenia wniosku</span>
              )}
              <span className="milestone-chip__date">{formatDate(milestone.date)}</span>
              <span>{milestone.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Widok osi poziomej na większych ekranach */}
      <div className="timeline-tracks" role="region" aria-label="Oś czasu w podziale na rodziców">
        {roles.map((role) => {
          const rolePeriods = periods.filter((p) => p.parentRole === role);
          return (
            <div key={role} className="timeline-track">
              <div className="timeline-track__label">{getParentRoleLabel(role)}</div>
              <div className="timeline-track__lane">
                {rolePeriods.length === 0 ? (
                  <span className="timeline-track__empty">Brak okresów</span>
                ) : (
                  rolePeriods.map((period, idx) => {
                    const startOffset = ((toEpochDays(period.startDate) - minDay) / totalSpan) * 100;
                    const widthPct = Math.max(
                      6,
                      ((toEpochDays(period.endDate) - toEpochDays(period.startDate) + 1) /
                        totalSpan) *
                        100,
                    );
                    const baseLabel = getLeaveTypeLabel(period.leaveType);
                    const label = period.workTimeFraction
                      ? `${baseLabel} + praca ${formatWorkFraction(period.workTimeFraction)}`
                      : baseLabel;
                    return (
                      <button
                        key={`${period.leaveType}-${period.startDate}-${idx}`}
                        type="button"
                        className={`timeline-bar ${getPeriodKindClass(period)}`}
                        style={{ left: `${startOffset}%`, width: `${widthPct}%` }}
                        onClick={() => onSelectDate(period.startDate)}
                        title={`${label} (${getParentRoleLabel(role)}): ${formatDate(period.startDate)} – ${formatDate(period.endDate)}, ${period.weeks} tyg., ${formatRate(period.rate)}`}
                      >
                        <span className="timeline-bar__title">{label}</span>
                        <span className="timeline-bar__meta">
                          {period.weeks} tyg. · {formatRate(period.rate)}
                          {period.workTimeFraction ? ' · Praca' : ''}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Czytelna lista okresów (podstawowy widok na mobile + szczegółowe kwoty na desktopie) */}
      <ul className="period-list" aria-label="Szczegółowa lista okresów urlopu">
        {periods.map((period, idx) => (
          <li key={`${period.leaveType}-${period.parentRole}-${period.startDate}-${idx}`}>
            <button
              type="button"
              className={
                period.workTimeFraction ? 'period-item period-item--with-work' : 'period-item'
              }
              onClick={() => onSelectDate(period.startDate)}
            >
              <span className="period-item__role">{getParentRoleLabel(period.parentRole)}</span>
              <span className="period-item__name">
                {getLeaveTypeLabel(period.leaveType)}
                {period.workTimeFraction && (
                  <span className="period-item__work-badge">
                    + praca ({formatWorkFraction(period.workTimeFraction)})
                  </span>
                )}
              </span>
              <span className="period-item__dates">
                {formatDate(period.startDate)} – {formatDate(period.endDate)} ({period.weeks} tyg. /{' '}
                {period.days} dni)
              </span>
              <span className="period-item__rate">
                Stawka zasiłku: <strong>{formatRate(period.rate)}</strong> · ok.{' '}
                {currencyFormatter.format(period.monthlyAmount)}/mies.
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
