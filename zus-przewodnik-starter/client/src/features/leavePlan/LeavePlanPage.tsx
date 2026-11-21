import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  BenefitParams,
  LeavePartRequest,
  MaternityCalculationResult,
  ParentalSplitResult,
  ParentalWithWorkResult,
  RateVariant,
} from '@shared/types';
import { useScenario } from '../../app/ScenarioContext';
import { PlaceholderPage } from '../../components/PlaceholderPage';
import {
  calculateMaternityPlan,
  fetchBenefitParams,
  requestParentalSplit,
  requestParentalWithWork,
} from './leavePlanApi';
import {
  addDaysIso,
  buildDemoScenario,
  buildPresetLeaveParts,
  createInitialLeaveParts,
  DEFAULT_BENEFIT_PARAMS,
  type LeavePlanPresetId,
} from './leavePlanMock';
import { LeaveSplitPlanner } from './LeaveSplitPlanner';
import {
  LeaveTimeline,
  type TimelineLeavePeriod,
  type TimelineMilestone,
} from './LeaveTimeline';
import { type CalendarQuickJump, MonthlyCalendar } from './MonthlyCalendar';
import './LeavePlanPage.css';

const PLAN_TABS = [
  { id: 'entitlements', label: 'Uprawnienia' },
  { id: 'calculator', label: 'Kalkulator' },
  { id: 'leave-plan', label: 'Plan urlopów' },
  { id: 'documents', label: 'Dokumenty i terminy' },
  { id: 'applications', label: 'Wnioski' },
  { id: 'support', label: 'Wsparcie' },
] as const;

function sortPartsWithWork(
  rawParts: LeavePartRequest[],
  rawWorkMap: Record<number, number>,
): { sortedParts: LeavePartRequest[]; sortedWorkMap: Record<number, number> } {
  const tagged = rawParts.map((part, oldIndex) => ({
    part,
    workFraction: rawWorkMap[oldIndex],
  }));

  tagged.sort((a, b) => {
    const dateCmp = a.part.startDate.localeCompare(b.part.startDate);
    if (dateCmp !== 0) return dateCmp;
    return a.part.parentRole.localeCompare(b.part.parentRole);
  });

  const sortedWorkMap: Record<number, number> = {};
  tagged.forEach((entry, newIndex) => {
    if (entry.workFraction !== undefined && entry.part.leaveType === 'parentalLeave') {
      sortedWorkMap[newIndex] = entry.workFraction;
    }
  });

  return {
    sortedParts: tagged.map((entry) => entry.part),
    sortedWorkMap,
  };
}

export function LeavePlanPage() {
  const { tab } = useParams<{ tab?: string }>();
  const activeTab = tab ?? 'leave-plan';

  const { scenario: draftScenario } = useScenario();
  const baseScenario = useMemo(() => buildDemoScenario(draftScenario), [draftScenario]);
  const [rateVariant, setRateVariant] = useState<RateVariant>(baseScenario.rateVariant);
  const scenario = useMemo(
    () => ({ ...baseScenario, rateVariant }),
    [baseScenario, rateVariant],
  );

  const [params, setParams] = useState<BenefitParams>(DEFAULT_BENEFIT_PARAMS);
  const [maternityResult, setMaternityResult] = useState<MaternityCalculationResult | null>(null);
  const [activePreset, setActivePreset] = useState<LeavePlanPresetId | null>('classic');
  const [parts, setParts] = useState<LeavePartRequest[]>(() =>
    sortPartsWithWork(createInitialLeaveParts(scenario, DEFAULT_BENEFIT_PARAMS), {}).sortedParts,
  );
  const [splitResult, setSplitResult] = useState<ParentalSplitResult | null>(null);
  const [workByPartIndex, setWorkByPartIndex] = useState<Record<number, number>>({});
  const [withWorkResults, setWithWorkResults] = useState<Record<number, ParentalWithWorkResult>>({});
  const [isDemoFallback, setIsDemoFallback] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const anchorDate = scenario.birthDate ?? scenario.expectedBirthDate ?? scenario.referenceDate;
  const [focusedMonth, setFocusedMonth] = useState<string>(anchorDate.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  function handleChangeMonth(monthIso: string) {
    setFocusedMonth(monthIso);
    setSelectedDay(null);
  }

  function handleSelectTimelineDate(dateIso: string, openDayDetails = false) {
    setFocusedMonth(dateIso.slice(0, 7));
    setSelectedDay(openDayDetails ? dateIso : null);
  }

  async function recomputeAllWork(
    targetParts: LeavePartRequest[],
    targetWorkMap: Record<number, number>,
    activeParams: BenefitParams,
  ): Promise<{ results: Record<number, ParentalWithWorkResult>; usedFallback: boolean }> {
    const entries = Object.entries(targetWorkMap);
    if (entries.length === 0) {
      return { results: {}, usedFallback: false };
    }

    let usedFallback = false;
    const results: Record<number, ParentalWithWorkResult> = {};

    await Promise.all(
      entries.map(async ([idxStr, fraction]) => {
        const idx = Number(idxStr);
        const part = targetParts[idx];
        if (!part || part.leaveType !== 'parentalLeave') return;
        const res = await requestParentalWithWork(
          {
            scenario,
            parentRole: part.parentRole,
            workTimeFraction: fraction,
            startDate: part.startDate,
            weeks: part.weeks,
          },
          activeParams,
        );
        results[idx] = res.data;
        if (res.isDemoFallback) usedFallback = true;
      }),
    );

    return { results, usedFallback };
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPlan() {
      setLoading(true);
      const paramsRes = await fetchBenefitParams();
      if (cancelled) return;

      const loadedParams = paramsRes.data;
      setParams(loadedParams);

      const rawParts =
        activePreset !== null
          ? buildPresetLeaveParts(activePreset, scenario, loadedParams)
          : parts;
      const { sortedParts, sortedWorkMap } = sortPartsWithWork(
        rawParts,
        activePreset !== null ? {} : workByPartIndex,
      );
      setParts(sortedParts);
      if (activePreset !== null) {
        setWorkByPartIndex({});
      }

      const [maternityRes, splitRes, workAll] = await Promise.all([
        calculateMaternityPlan(scenario, loadedParams),
        requestParentalSplit({ scenario, parts: sortedParts }, loadedParams),
        recomputeAllWork(sortedParts, sortedWorkMap, loadedParams),
      ]);

      if (cancelled) return;
      setMaternityResult(maternityRes.data);
      setSplitResult(splitRes.data);
      setWithWorkResults(workAll.results);
      setIsDemoFallback(
        maternityRes.isDemoFallback || splitRes.isDemoFallback || workAll.usedFallback,
      );
      setLoading(false);
    }

    void loadInitialPlan();
    return () => {
      cancelled = true;
    };
    // Reagujemy na zmianę scenariusza (np. stawka 81,5% vs 100%+70%).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  async function updateParts(
    rawNextParts: LeavePartRequest[],
    presetId: LeavePlanPresetId | null = null,
    rawNextWorkMap: Record<number, number> = workByPartIndex,
  ) {
    const { sortedParts, sortedWorkMap } = sortPartsWithWork(rawNextParts, rawNextWorkMap);
    setActivePreset(presetId);
    setParts(sortedParts);
    setWorkByPartIndex(sortedWorkMap);

    const [splitRes, workAll] = await Promise.all([
      requestParentalSplit({ scenario, parts: sortedParts }, params),
      recomputeAllWork(sortedParts, sortedWorkMap, params),
    ]);

    setSplitResult(splitRes.data);
    setWithWorkResults(workAll.results);
    setIsDemoFallback((prev) => prev || splitRes.isDemoFallback || workAll.usedFallback);
  }

  async function handleSelectPreset(presetId: LeavePlanPresetId) {
    const presetParts = buildPresetLeaveParts(presetId, scenario, params);
    await updateParts(presetParts, presetId, {});
  }

  async function handleChangeWorkForPart(partIndex: number, workTimeFraction: number | null) {
    const nextWorkMap = { ...workByPartIndex };
    if (workTimeFraction === null) {
      delete nextWorkMap[partIndex];
    } else {
      nextWorkMap[partIndex] = workTimeFraction;
    }
    setWorkByPartIndex(nextWorkMap);

    const workAll = await recomputeAllWork(parts, nextWorkMap, params);
    setWithWorkResults(workAll.results);
    setIsDemoFallback((prev) => prev || workAll.usedFallback);
  }

  const combinedPeriods: TimelineLeavePeriod[] = useMemo(() => {
    const basePeriods: TimelineLeavePeriod[] = maternityResult?.periods ?? [];
    const splitPeriods: TimelineLeavePeriod[] = (splitResult?.periods ?? []).map((period, idx) => {
      const workFraction = workByPartIndex[idx];
      const workRes = withWorkResults[idx];
      if (workFraction && workRes && workRes.periods[0]) {
        return {
          ...workRes.periods[0],
          workTimeFraction: workFraction,
        };
      }
      return period;
    });
    return [...basePeriods, ...splitPeriods].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
  }, [maternityResult, splitResult, workByPartIndex, withWorkResults]);

  const milestones: TimelineMilestone[] = useMemo(() => {
    const list: TimelineMilestone[] = [
      {
        date: anchorDate,
        label: 'Data porodu',
        kind: 'event',
        description: 'Początek urlopu macierzyńskiego po porodzie.',
      },
    ];

    const isAlive = !scenario.special.stillbirth && scenario.special.childDeathDate === null;
    if (isAlive) {
      if (rateVariant === 'combined') {
        list.push({
          date: addDaysIso(anchorDate, params.combinedRateApplicationDeadlineDays),
          label: `Wniosek o 81,5% za cały urlop (do ${params.combinedRateApplicationDeadlineDays} dni po porodzie)`,
          kind: 'deadline',
          description:
            'Ostatni dzień na złożenie wniosku (u pracodawcy albo do ZUS przy działalności/zleceniu) o równą stawkę 81,5% przez cały urlop macierzyński i rodzicielski. Jeśli przegapisz ten termin, dostaniesz 100% na macierzyńskim i 70% na rodzicielskim.',
        });
      } else {
        const firstParental = combinedPeriods.find((p) => p.leaveType === 'parentalLeave');
        if (firstParental) {
          list.push({
            date: addDaysIso(firstParental.startDate, -params.applicationDeadlinesDays.parentalLeave),
            label: `Wniosek o urlop rodzicielski (${params.applicationDeadlinesDays.parentalLeave} dni przed startem)`,
            kind: 'deadline',
            description:
              'Najpóźniej do tego dnia złóż wniosek o urlop rodzicielski (u pracodawcy lub w ZUS, np. na druku ZAM), aby rozpocząć urlop bez przerwy po macierzyńskim.',
          });
        }
      }

      const firstPaternity = combinedPeriods.find((p) => p.leaveType === 'paternityLeave');
      if (firstPaternity) {
        list.push({
          date: addDaysIso(firstPaternity.startDate, -params.applicationDeadlinesDays.paternityLeave),
          label: `Wniosek o urlop ojcowski (${params.applicationDeadlinesDays.paternityLeave} dni przed startem)`,
          kind: 'deadline',
          description:
            'Ostatni dzień na złożenie wniosku o urlop ojcowski (min. 7 dni przed rozpoczęciem urlopu — u pracodawcy albo do ZUS).',
        });
      }
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [
    anchorDate,
    combinedPeriods,
    params.applicationDeadlinesDays.parentalLeave,
    params.applicationDeadlinesDays.paternityLeave,
    params.combinedRateApplicationDeadlineDays,
    rateVariant,
    scenario.special,
  ]);

  const quickJumps: CalendarQuickJump[] = useMemo(() => {
    const jumps: CalendarQuickJump[] = [{ label: 'Poród', monthIso: anchorDate.slice(0, 7) }];
    const firstParental = combinedPeriods.find((p) => p.leaveType === 'parentalLeave');
    if (firstParental) {
      jumps.push({ label: 'Start rodzicielskiego', monthIso: firstParental.startDate.slice(0, 7) });
    }
    const firstFather = combinedPeriods.find((p) => p.parentRole === 'father');
    if (firstFather) {
      jumps.push({ label: 'Start urlopu Ojca', monthIso: firstFather.startDate.slice(0, 7) });
    }
    return jumps;
  }, [anchorDate, combinedPeriods]);

  const isSensitiveSituation =
    scenario.special.stillbirth || scenario.special.childDeathDate !== null;

  return (
    <div className="leave-plan-page">
      <header className="leave-plan-header">
        <div className="leave-plan-container">
          <div className="leave-plan-header__top">
            <Link to="/" className="leave-plan-header__back">
              ‹ Strona startowa
            </Link>
            <span className="leave-plan-badge">
              Wersja demonstracyjna – dane i logowanie są symulowane
            </span>
          </div>
          <h1 className="leave-plan-header__title">Twój plan urlopów</h1>
          <p className="leave-plan-header__subtitle">
            {isSensitiveSituation
              ? 'Sprawdź przysługujące Ci okresy urlopu oraz najważniejsze terminy złożenia dokumentów.'
              : 'Na podstawie Twoich danych przygotowaliśmy domyślną propozycję planu. Możesz ją dowolnie zmienić poniżej.'}
          </p>

          <nav aria-label="Sekcje planu" className="plan-tabs">
            {PLAN_TABS.map((item) => (
              <Link
                key={item.id}
                to={`/plan/${item.id}`}
                className={activeTab === item.id ? 'plan-tab plan-tab--active' : 'plan-tab'}
                aria-current={activeTab === item.id ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="leave-plan-main">
        <div className="leave-plan-container">
          {activeTab !== 'leave-plan' ? (
            <PlaceholderPage />
          ) : (
            <>
              {isDemoFallback && (
                <div className="demo-notice" role="status">
                  Widok korzysta z danych demonstracyjnych dla planu urlopów – po uruchomieniu
                  endpointów obliczeń w API przełączy się automatycznie na dane z serwera.
                </div>
              )}

              <section className="rate-switcher" aria-label="Wybór wariantu stawki zasiłku">
                <div className="rate-switcher__text">
                  <strong>Wariant wypłaty zasiłku:</strong> sprawdź na osi czasu, jak zmieniają się
                  procenty.
                </div>
                <div className="rate-switcher__buttons" role="group" aria-label="Wariant stawki">
                  <button
                    type="button"
                    className={
                      rateVariant === 'combined'
                        ? 'rate-btn rate-btn--active'
                        : 'rate-btn'
                    }
                    aria-pressed={rateVariant === 'combined'}
                    onClick={() => setRateVariant('combined')}
                  >
                    81,5% równomiernie (wniosek do {params.combinedRateApplicationDeadlineDays}{' '}
                    dni)
                  </button>
                  <button
                    type="button"
                    className={
                      rateVariant === 'standard'
                        ? 'rate-btn rate-btn--active'
                        : 'rate-btn'
                    }
                    aria-pressed={rateVariant === 'standard'}
                    onClick={() => setRateVariant('standard')}
                  >
                    100% macierzyński + 70% rodzicielski
                  </button>
                </div>
              </section>

              <section className="leave-summary-grid" aria-label="Podsumowanie puli urlopów">
                <div className="summary-tile">
                  <span className="summary-tile__label">Pozostały rodzicielski – Matka</span>
                  <strong className="summary-tile__value">
                    {splitResult ? `${splitResult.remainingWeeks.mother} tyg.` : '—'}
                  </strong>
                </div>
                <div className="summary-tile">
                  <span className="summary-tile__label">Pozostały rodzicielski – Ojciec</span>
                  <strong className="summary-tile__value">
                    {splitResult ? `${splitResult.remainingWeeks.father} tyg.` : '—'}
                  </strong>
                </div>
                <div className="summary-tile">
                  <span className="summary-tile__label">Wyłącznie dla każdego rodzica</span>
                  <strong className="summary-tile__value">
                    po {params.parentalLeave.nonTransferableWeeksPerParent} tyg.
                  </strong>
                </div>
                <div className="summary-tile">
                  <span className="summary-tile__label">Wybrany wariant stawki</span>
                  <strong className="summary-tile__value">
                    {rateVariant === 'combined' ? '81,5% (wniosek 21 dni)' : '100% + 70%'}
                  </strong>
                </div>
              </section>

              {loading ? (
                <p className="leave-loading" role="status">
                  Wczytywanie planu urlopów...
                </p>
              ) : (
                <div className="leave-sections">
                  <LeaveTimeline
                    periods={combinedPeriods}
                    milestones={milestones}
                    onSelectDate={handleSelectTimelineDate}
                  />

                  <MonthlyCalendar
                    periods={combinedPeriods}
                    milestones={milestones}
                    quickJumps={quickJumps}
                    focusedMonth={focusedMonth}
                    selectedDay={selectedDay}
                    onSelectDay={setSelectedDay}
                    onChangeMonth={handleChangeMonth}
                  />

                  <LeaveSplitPlanner
                    scenario={scenario}
                    params={params}
                    parts={parts}
                    activePreset={activePreset}
                    splitResult={splitResult}
                    workByPartIndex={workByPartIndex}
                    withWorkResults={withWorkResults}
                    onSelectPreset={(presetId) => void handleSelectPreset(presetId)}
                    onAddPart={(part) => void updateParts([...parts, part], null)}
                    onUpdatePart={(idx, updatedPart) =>
                      void updateParts(
                        parts.map((item, index) => (index === idx ? updatedPart : item)),
                        null,
                      )
                    }
                    onRemovePart={(idx) => {
                      const nextParts = parts.filter((_, index) => index !== idx);
                      const nextWorkMap: Record<number, number> = {};
                      Object.entries(workByPartIndex).forEach(([kStr, val]) => {
                        const k = Number(kStr);
                        if (k < idx) nextWorkMap[k] = val;
                        else if (k > idx) nextWorkMap[k - 1] = val;
                      });
                      void updateParts(nextParts, null, nextWorkMap);
                    }}
                    onResetParts={() =>
                      void updateParts(createInitialLeaveParts(scenario, params), 'classic', {})
                    }
                    onChangeWorkForPart={(partIdx, frac) =>
                      void handleChangeWorkForPart(partIdx, frac)
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
