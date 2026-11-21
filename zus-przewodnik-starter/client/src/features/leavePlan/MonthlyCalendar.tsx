import type { TimelineLeavePeriod, TimelineMilestone } from './LeaveTimeline';
import { getLeaveTypeLabel, getParentRoleLabel } from './leavePlanMock';

export interface CalendarQuickJump {
  label: string;
  monthIso: string; // 'YYYY-MM'
}

interface MonthlyCalendarProps {
  periods: TimelineLeavePeriod[];
  milestones: TimelineMilestone[];
  quickJumps: CalendarQuickJump[];
  focusedMonth: string; // 'YYYY-MM'
  selectedDay: string | null; // 'YYYY-MM-DD'
  onSelectDay: (isoDate: string | null) => void;
  onChangeMonth: (monthIso: string) => void;
}

const WEEKDAYS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

const monthTitleFormatter = new Intl.DateTimeFormat('pl-PL', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const fullDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function shiftMonth(monthIso: string, delta: number): string {
  const [year, month] = monthIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getMondayBasedWeekday(year: number, month: number, day: number): number {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function MonthlyCalendar({
  periods,
  milestones,
  quickJumps,
  focusedMonth,
  selectedDay,
  onSelectDay,
  onChangeMonth,
}: MonthlyCalendarProps) {
  const [year, month] = focusedMonth.split('-').map(Number);
  const daysCount = getDaysInMonth(year, month);
  const leadingEmpty = getMondayBasedWeekday(year, month, 1);

  const monthTitle = monthTitleFormatter.format(new Date(Date.UTC(year, month - 1, 1)));

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingEmpty }, () => null),
    ...Array.from({ length: daysCount }, (_, index) => index + 1),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  function getIsoForDay(day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function getActivePeriods(isoDate: string): TimelineLeavePeriod[] {
    return periods.filter((p) => isoDate >= p.startDate && isoDate <= p.endDate);
  }

  function getMilestonesForDay(isoDate: string): TimelineMilestone[] {
    return milestones.filter((m) => m.date === isoDate);
  }

  const activeDayPeriods = selectedDay ? getActivePeriods(selectedDay) : [];
  const activeDayMilestones = selectedDay ? getMilestonesForDay(selectedDay) : [];

  return (
    <section className="leave-card" aria-labelledby="monthly-calendar-heading">
      <div className="calendar-header">
        <div>
          <h2 id="monthly-calendar-heading" className="leave-card__title">
            Kalendarz miesięczny
          </h2>
          <p className="leave-card__lead">
            Wybierz dzień, aby sprawdzić dokładne świadczenia oraz instrukcję, jaki wniosek złożyć.
          </p>
        </div>

        <div className="calendar-nav">
          <button
            type="button"
            className="calendar-nav__btn"
            onClick={() => onChangeMonth(shiftMonth(focusedMonth, -1))}
            aria-label="Poprzedni miesiąc"
          >
            ‹ Poprzedni
          </button>
          <span className="calendar-nav__title" aria-live="polite">
            {monthTitle}
          </span>
          <button
            type="button"
            className="calendar-nav__btn"
            onClick={() => onChangeMonth(shiftMonth(focusedMonth, 1))}
            aria-label="Następny miesiąc"
          >
            Następny ›
          </button>
        </div>
      </div>

      {quickJumps.length > 0 && (
        <div className="calendar-jumps" aria-label="Szybkie przejście do ważnych momentów">
          <span className="calendar-jumps__label">Skocz do:</span>
          {quickJumps.map((jump) => (
            <button
              key={`${jump.monthIso}-${jump.label}`}
              type="button"
              className={
                focusedMonth === jump.monthIso
                  ? 'calendar-jump-btn calendar-jump-btn--active'
                  : 'calendar-jump-btn'
              }
              onClick={() => onChangeMonth(jump.monthIso)}
            >
              {jump.label}
            </button>
          ))}
        </div>
      )}

      <div className="calendar-grid" role="grid" aria-label={`Kalendarz: ${monthTitle}`}>
        {WEEKDAYS_PL.map((dayName) => (
          <div key={dayName} className="calendar-weekday" role="columnheader">
            {dayName}
          </div>
        ))}

        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="calendar-day calendar-day--empty" />;
          }

          const isoDate = getIsoForDay(day);
          const dayPeriods = getActivePeriods(isoDate);
          const dayMilestones = getMilestonesForDay(isoDate);
          const hasMother = dayPeriods.some((p) => p.parentRole === 'mother');
          const hasFather = dayPeriods.some((p) => p.parentRole === 'father');
          const hasWork = dayPeriods.some((p) => Boolean(p.workTimeFraction));
          const hasDeadline = dayMilestones.some((m) => m.kind === 'deadline');
          const isSelected = selectedDay === isoDate;

          const roleBadge =
            hasMother && hasFather ? 'M+O' : hasMother ? 'M' : hasFather ? 'O' : '';

          const dayClasses = [
            'calendar-day',
            hasMother ? 'calendar-day--mother' : '',
            hasFather ? 'calendar-day--father' : '',
            hasWork ? 'calendar-day--work' : '',
            dayMilestones.length > 0 ? 'calendar-day--milestone' : '',
            hasDeadline ? 'calendar-day--deadline' : '',
            isSelected ? 'calendar-day--selected' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const formattedFull = fullDateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
          const ariaParts = [formattedFull];
          if (dayPeriods.length > 0) {
            ariaParts.push(
              dayPeriods
                .map((p) => {
                  const base = `${getLeaveTypeLabel(p.leaveType)} (${getParentRoleLabel(p.parentRole)})`;
                  return p.workTimeFraction ? `${base} + praca` : base;
                })
                .join(', '),
            );
          }
          if (dayMilestones.length > 0) {
            ariaParts.push(
              dayMilestones
                .map((m) =>
                  m.kind === 'deadline' ? `Termin złożenia wniosku: ${m.label}` : m.label,
                )
                .join(', '),
            );
          }

          return (
            <button
              key={isoDate}
              type="button"
              className={dayClasses}
              aria-label={ariaParts.join(' – ')}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(isSelected ? null : isoDate)}
            >
              <span className="calendar-day__num">{day}</span>
              <span className="calendar-day__badges" aria-hidden="true">
                {roleBadge && <span className="calendar-day__role">{roleBadge}</span>}
                {hasWork && <span className="calendar-day__work">+P</span>}
                {hasDeadline ? (
                  <span className="calendar-day__deadline-badge">Wniosek</span>
                ) : (
                  dayMilestones.length > 0 && <span className="calendar-day__star">★</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="calendar-legend" aria-label="Legenda kalendarza">
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--mother" aria-hidden="true">
            M
          </span>
          Urlop Matki
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--father" aria-hidden="true">
            O
          </span>
          Urlop Ojca
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--work" aria-hidden="true">
            +P
          </span>
          Praca w trakcie urlopu
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--deadline" aria-hidden="true">
            Wn.
          </span>
          Termin złożenia / wypełnienia wniosku
        </span>
      </div>

      {selectedDay && (
        <div className="calendar-day-details" aria-live="polite">
          <div className="calendar-day-details__header">
            <h3 className="calendar-day-details__title">
              Szczegóły dla dnia:{' '}
              {fullDateFormatter.format(
                new Date(
                  Date.UTC(
                    Number(selectedDay.slice(0, 4)),
                    Number(selectedDay.slice(5, 7)) - 1,
                    Number(selectedDay.slice(8, 10)),
                  ),
                ),
              )}
            </h3>
            <button
              type="button"
              className="calendar-day-details__close"
              onClick={() => onSelectDay(null)}
            >
              Zamknij
            </button>
          </div>

          {activeDayMilestones.length > 0 && (
            <div className="calendar-day-details__milestones">
              {activeDayMilestones.map((m) => (
                <div
                  key={`${m.date}-${m.label}`}
                  className={
                    m.kind === 'deadline'
                      ? 'deadline-callout'
                      : 'deadline-callout deadline-callout--event'
                  }
                >
                  <strong>
                    {m.kind === 'deadline' ? 'Termin złożenia wniosku: ' : 'Wydarzenie: '}
                    {m.label}
                  </strong>
                  <p className="deadline-callout__desc">{m.description}</p>
                </div>
              ))}
            </div>
          )}

          {activeDayPeriods.length > 0 ? (
            <ul className="calendar-day-details__list">
              {activeDayPeriods.map((p, idx) => (
                <li key={`${p.leaveType}-${p.parentRole}-${idx}`}>
                  <strong>{getParentRoleLabel(p.parentRole)}</strong> –{' '}
                  {getLeaveTypeLabel(p.leaveType)} (stawka {Math.round(p.rate * 1000) / 10}%)
                  {p.workTimeFraction
                    ? ` · praca ${p.workTimeFraction === 0.25 ? '1/4' : '1/2'} etatu`
                    : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="calendar-day-details__empty">Brak aktywnego urlopu w tym dniu.</p>
          )}
        </div>
      )}
    </section>
  );
}
