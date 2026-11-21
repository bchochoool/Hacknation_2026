import type {
  BenefitParams,
  LeavePartRequest,
  LeavePeriod,
  LeaveType,
  MaternityCalculationResult,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
  ParentRole,
  ScenarioInput,
} from '@shared/types';
import type { ScenarioDraft } from '../../app/ScenarioContext';
import defaultParamsJson from '@shared/params.json';

export const DEFAULT_BENEFIT_PARAMS: BenefitParams = defaultParamsJson as BenefitParams;

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH_APPROX = 30;

function roundPln(value: number): number {
  return Math.round(value * 100) / 100;
}

export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getLeaveTypeLabel(leaveType: LeaveType): string {
  switch (leaveType) {
    case 'maternityLeave':
      return 'Urlop macierzyński';
    case 'adoptionMaternityLeave':
      return 'Urlop na warunkach macierzyńskiego';
    case 'supplementaryMaternityLeave':
      return 'Uzupełniający urlop macierzyński';
    case 'parentalLeave':
      return 'Urlop rodzicielski';
    case 'paternityLeave':
      return 'Urlop ojcowski';
  }
}

export function getParentRoleLabel(role: ParentRole): string {
  return role === 'mother' ? 'Matka' : 'Ojciec';
}

/**
 * Buduje kompletny scenariusz na podstawie szkicu z ScenarioContext,
 * aby widok kalendarza działał także przy bezpośrednim wejściu na /plan/leave-plan.
 */
export function buildDemoScenario(draft: ScenarioDraft): ScenarioInput {
  const referenceDate = draft.referenceDate ?? '2026-11-21';
  const situation = draft.situation ?? 'afterBirth';
  const birthDate = draft.birthDate ?? '2026-11-10';

  return {
    situation,
    referenceDate,
    expectedBirthDate: draft.expectedBirthDate ?? birthDate,
    birthDate,
    childrenCount: draft.childrenCount ?? 1,
    adoptionType: draft.adoptionType ?? null,
    childAcceptanceDate: draft.childAcceptanceDate ?? null,
    childAgeYears: draft.childAgeYears ?? null,
    schoolObligationDeferred: draft.schoolObligationDeferred ?? false,
    rateVariant: draft.rateVariant ?? 'combined',
    mother: draft.mother ?? {
      role: 'mother',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2023-05-01',
      insuranceEndDate: null,
      benefitBase: 5500,
      employerInsuredCount: 45,
      age: 30,
      contributionDebt: null,
      wantsLeave: true,
    },
    father: draft.father ?? {
      role: 'father',
      insuranceTitle: 'employment',
      sicknessInsurance: 'mandatory',
      insuredSince: '2022-01-10',
      insuranceEndDate: null,
      benefitBase: 6200,
      employerInsuredCount: 30,
      age: 32,
      contributionDebt: null,
      wantsLeave: true,
    },
    special: draft.special ?? {
      zaZyciemCertificate: false,
      pregnancyWeekAtBirth: null,
      birthWeightGrams: null,
      hospitalizationDays: null,
      stillbirth: false,
      childDeathDate: null,
      motherHospitalized: false,
      motherIncapableOfIndependentLiving: false,
      motherDeceased: false,
      employerBankruptcyOrLiquidation: false,
    },
  };
}

function getMaternityWeeks(childrenCount: number, params: BenefitParams): number {
  const clamped = Math.min(Math.max(childrenCount, 1), 5) as 1 | 2 | 3 | 4 | 5;
  const key = String(clamped) as '1' | '2' | '3' | '4' | '5';
  return params.maternityLeave.weeksByChildrenCount[key];
}

function getParentalTotalWeeks(scenario: ScenarioInput, params: BenefitParams): number {
  const multiple = scenario.childrenCount > 1;
  if (scenario.special.zaZyciemCertificate) {
    return multiple
      ? params.parentalLeave.weeksMultipleChildrenZaZyciem
      : params.parentalLeave.weeksSingleChildZaZyciem;
  }
  return multiple
    ? params.parentalLeave.weeksMultipleChildren
    : params.parentalLeave.weeksSingleChild;
}

function buildPeriod(
  leaveType: LeaveType,
  parentRole: ParentRole,
  startDate: string,
  weeks: number,
  rate: number,
  benefitBase: number,
): LeavePeriod {
  const days = weeks * DAYS_IN_WEEK;
  const endDate = addDaysIso(startDate, days - 1);
  const dailyGross = (benefitBase * rate) / DAYS_IN_MONTH_APPROX;
  return {
    leaveType,
    parentRole,
    startDate,
    endDate,
    weeks,
    days,
    rate,
    monthlyAmount: roundPln(benefitBase * rate),
    totalAmount: roundPln(dailyGross * days),
  };
}

/**
 * Tymczasowy generator okresów macierzyńskiego na czas prac nad silnikiem (Osoba 5).
 */
export function buildDemoMaternityPeriods(
  scenario: ScenarioInput,
  params: BenefitParams,
): MaternityCalculationResult {
  const anchorDate = scenario.birthDate ?? scenario.expectedBirthDate ?? scenario.referenceDate;
  const maternityWeeks = getMaternityWeeks(scenario.childrenCount, params);
  const motherBase = scenario.mother.benefitBase ?? params.benefitBase.minimumWage;
  const maternityRate =
    scenario.rateVariant === 'combined' ? params.rates.combined : params.rates.maternity;

  const isAdoption = scenario.situation === 'adoption';
  const firstLeaveType: LeaveType = isAdoption ? 'adoptionMaternityLeave' : 'maternityLeave';

  const maternityPeriod = buildPeriod(
    firstLeaveType,
    'mother',
    anchorDate,
    maternityWeeks,
    maternityRate,
    motherBase,
  );

  const periods: LeavePeriod[] = [maternityPeriod];

  return {
    periods,
    totalAmount: maternityPeriod.totalAmount,
    variants: {
      standard: maternityPeriod.totalAmount,
      combined: maternityPeriod.totalAmount,
    },
    explanations: [
      {
        message: `Podgląd na danych demonstracyjnych: ${maternityWeeks} tyg. urlopu dla ${scenario.childrenCount} dziecka/dzieci.`,
        legalBasis: 'KP art. 180 § 1',
      },
    ],
    warnings: [],
  };
}

export type LeavePlanPresetId =
  | 'classic'
  | 'equal'
  | 'onlyMother'
  | 'onlyFather'
  | 'fatherRightAfterBirth';

export interface LeavePlanPreset {
  id: LeavePlanPresetId;
  title: string;
  description: string;
}

export const LEAVE_PLAN_PRESETS: LeavePlanPreset[] = [
  {
    id: 'classic',
    title: 'Najpierw Mama, potem Tata',
    description: 'Mama bierze maksymalną część, a Tata swoje 9 tyg. na końcu + 2 tyg. po porodzie.',
  },
  {
    id: 'equal',
    title: 'Po połowie',
    description: 'Rodzice dzielą cały urlop rodzicielski równo między siebie.',
  },
  {
    id: 'onlyMother',
    title: 'Tylko Mama (rodzicielski)',
    description: 'Mama bierze maksymalną część dla jednego rodzica (9 tyg. Taty pozostaje niewykorzystane).',
  },
  {
    id: 'onlyFather',
    title: 'Tylko Tata (rodzicielski)',
    description: 'Po macierzyńskim cały urlop rodzicielski dla jednego rodzica + ojcowski bierze Tata.',
  },
  {
    id: 'fatherRightAfterBirth',
    title: 'Tata od razu przy porodzie',
    description: 'Tata bierze 2 tyg. ojcowskiego od dnia porodu, a później swoje 9 tyg. rodzicielskiego.',
  },
];

export function getMaternityEndDate(scenario: ScenarioInput, params: BenefitParams): string {
  const anchorDate = scenario.birthDate ?? scenario.expectedBirthDate ?? scenario.referenceDate;
  const maternityWeeks = getMaternityWeeks(scenario.childrenCount, params);
  return addDaysIso(anchorDate, maternityWeeks * DAYS_IN_WEEK - 1);
}

export function getParentalPoolSummary(scenario: ScenarioInput, params: BenefitParams) {
  const totalWeeks = getParentalTotalWeeks(scenario, params);
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  return {
    totalWeeks,
    nonTransferable,
    maxSingleParentWeeks: totalWeeks - nonTransferable,
  };
}

export interface PartLimitInfo {
  maxWeeks: number;
  maxPartsReached: boolean;
  limitReason: string | null;
}

/**
 * Wylicza maksymalną dozwoloną liczbę tygodni dla dodawanej lub edytowanej części
 * na podstawie limitów z params.json, aby UI nie pozwoliło przekroczyć limitu.
 */
export function getPartLimitInfo(
  parts: LeavePartRequest[],
  targetRole: ParentRole,
  targetLeaveType: 'parentalLeave' | 'paternityLeave',
  scenario: ScenarioInput,
  params: BenefitParams,
  editingIndex: number | null = null,
): PartLimitInfo {
  const otherParts = parts.filter((_, idx) => idx !== editingIndex);

  if (targetLeaveType === 'paternityLeave') {
    const otherPaternityParts = otherParts.filter((p) => p.leaveType === 'paternityLeave');
    const usedPaternityWeeks = otherPaternityParts.reduce((sum, p) => sum + p.weeks, 0);
    const maxWeeks = Math.max(0, params.paternityLeave.weeks - usedPaternityWeeks);
    const maxPartsReached =
      editingIndex === null && otherPaternityParts.length >= params.paternityLeave.maxParts;

    let limitReason: string | null = null;
    if (maxPartsReached) {
      limitReason = `Urlop ojcowski można podzielić maksymalnie na ${params.paternityLeave.maxParts} części.`;
    } else if (maxWeeks === 0) {
      limitReason = `Wykorzystano już pełne ${params.paternityLeave.weeks} tyg. urlopu ojcowskiego.`;
    } else {
      limitReason = `Możesz zaplanować maksymalnie ${maxWeeks} tyg. (limit urlopu ojcowskiego to ${params.paternityLeave.weeks} tyg.).`;
    }

    return { maxWeeks, maxPartsReached, limitReason };
  }

  const pool = getParentalPoolSummary(scenario, params);
  const otherParentalParts = otherParts.filter((p) => p.leaveType === 'parentalLeave');
  const maxPartsReached =
    editingIndex === null && otherParentalParts.length >= params.parentalLeave.maxParts;

  const totalUsed = otherParentalParts.reduce((sum, p) => sum + p.weeks, 0);
  const sameParentUsed = otherParentalParts
    .filter((p) => p.parentRole === targetRole)
    .reduce((sum, p) => sum + p.weeks, 0);

  const remainingTotal = Math.max(0, pool.totalWeeks - totalUsed);
  const remainingForParent = Math.max(0, pool.maxSingleParentWeeks - sameParentUsed);
  const maxWeeks = Math.min(remainingTotal, remainingForParent);
  const otherRoleLabel = targetRole === 'mother' ? 'Ojca' : 'Matki';
  const roleLabel = targetRole === 'mother' ? 'Matki' : 'Ojca';

  let limitReason: string | null = null;
  if (maxPartsReached) {
    limitReason = `Osiągnięto limit ${params.parentalLeave.maxParts} części urlopu rodzicielskiego.`;
  } else if (remainingTotal === 0) {
    limitReason = `Wykorzystano całą wspólną pulę ${pool.totalWeeks} tyg. urlopu rodzicielskiego.`;
  } else if (remainingForParent === 0) {
    limitReason = `Osiągnięto limit dla ${roleLabel} (${pool.maxSingleParentWeeks} tyg.) – pozostałe ${pool.nonTransferable} tyg. przysługuje wyłącznie dla ${otherRoleLabel}.`;
  } else if (remainingForParent < remainingTotal) {
    limitReason = `Dla ${roleLabel} możesz dodać maksymalnie ${maxWeeks} tyg. (bo ${pool.nonTransferable} tyg. jest zastrzeżone dla ${otherRoleLabel}).`;
  } else {
    limitReason = `Zostało jeszcze ${maxWeeks} tyg. ze wspólnej puli ${pool.totalWeeks} tyg.`;
  }

  return { maxWeeks, maxPartsReached, limitReason };
}

export function buildPresetLeaveParts(
  presetId: LeavePlanPresetId,
  scenario: ScenarioInput,
  params: BenefitParams,
): LeavePartRequest[] {
  const anchorDate = scenario.birthDate ?? scenario.expectedBirthDate ?? scenario.referenceDate;
  const maternityWeeks = getMaternityWeeks(scenario.childrenCount, params);
  const parentalTotal = getParentalTotalWeeks(scenario, params);
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const parentalStart = addDaysIso(anchorDate, maternityWeeks * DAYS_IN_WEEK);

  if (presetId === 'onlyMother') {
    return [
      {
        parentRole: 'mother',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: parentalTotal - nonTransferable,
      },
    ];
  }

  if (presetId === 'onlyFather') {
    return [
      {
        parentRole: 'father',
        leaveType: 'paternityLeave',
        startDate: addDaysIso(anchorDate, DAYS_IN_WEEK),
        weeks: params.paternityLeave.weeks,
      },
      {
        parentRole: 'father',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: parentalTotal - nonTransferable,
      },
    ];
  }

  if (presetId === 'equal') {
    const motherWeeks = Math.ceil(parentalTotal / 2);
    const fatherWeeks = parentalTotal - motherWeeks;
    const fatherStart = addDaysIso(parentalStart, motherWeeks * DAYS_IN_WEEK);
    return [
      {
        parentRole: 'mother',
        leaveType: 'parentalLeave',
        startDate: parentalStart,
        weeks: motherWeeks,
      },
      {
        parentRole: 'father',
        leaveType: 'parentalLeave',
        startDate: fatherStart,
        weeks: fatherWeeks,
      },
      {
        parentRole: 'father',
        leaveType: 'paternityLeave',
        startDate: addDaysIso(anchorDate, DAYS_IN_WEEK),
        weeks: params.paternityLeave.weeks,
      },
    ];
  }

  const motherParentalWeeks = parentalTotal - nonTransferable;
  const fatherParentalStart = addDaysIso(parentalStart, motherParentalWeeks * DAYS_IN_WEEK);
  const paternityStart =
    presetId === 'fatherRightAfterBirth' ? anchorDate : addDaysIso(anchorDate, DAYS_IN_WEEK * 2);

  const parts: LeavePartRequest[] = [
    {
      parentRole: 'mother',
      leaveType: 'parentalLeave',
      startDate: parentalStart,
      weeks: motherParentalWeeks,
    },
  ];

  if (scenario.father && scenario.father.wantsLeave) {
    parts.push({
      parentRole: 'father',
      leaveType: 'parentalLeave',
      startDate: fatherParentalStart,
      weeks: nonTransferable,
    });
    parts.push({
      parentRole: 'father',
      leaveType: 'paternityLeave',
      startDate: paternityStart,
      weeks: params.paternityLeave.weeks,
    });
  }

  return parts;
}

export function createInitialLeaveParts(
  scenario: ScenarioInput,
  params: BenefitParams,
): LeavePartRequest[] {
  return buildPresetLeaveParts('classic', scenario, params);
}

/**
 * Tymczasowa symulacja odpowiedzi /api/v1/plan/parental-split (Osoba 4 + 5).
 */
export function buildDemoParentalSplit(
  input: ParentalSplitInput,
  params: BenefitParams,
): ParentalSplitResult {
  const { scenario, parts } = input;
  const totalParentalPool = getParentalTotalWeeks(scenario, params);
  const nonTransferable = params.parentalLeave.nonTransferableWeeksPerParent;
  const motherBase = scenario.mother.benefitBase ?? params.benefitBase.minimumWage;
  const fatherBase = scenario.father?.benefitBase ?? params.benefitBase.minimumWage;

  const parentalParts = parts.filter((part) => part.leaveType === 'parentalLeave');
  const paternityParts = parts.filter((part) => part.leaveType === 'paternityLeave');

  const errors: ParentalSplitResult['errors'] = [];

  if (parentalParts.length > params.parentalLeave.maxParts) {
    errors.push({
      message: `Urlop rodzicielski można podzielić maksymalnie na ${params.parentalLeave.maxParts} części.`,
      legalBasis: 'KP art. 182^1d § 1',
    });
  }

  if (paternityParts.length > params.paternityLeave.maxParts) {
    errors.push({
      message: `Urlop ojcowski można wykorzystać maksymalnie w ${params.paternityLeave.maxParts} częściach.`,
      legalBasis: 'KP art. 182^3 § 1^1',
    });
  }

  const motherParentalUsed = parentalParts
    .filter((p) => p.parentRole === 'mother')
    .reduce((sum, p) => sum + p.weeks, 0);
  const fatherParentalUsed = parentalParts
    .filter((p) => p.parentRole === 'father')
    .reduce((sum, p) => sum + p.weeks, 0);
  const paternityUsed = paternityParts.reduce((sum, p) => sum + p.weeks, 0);

  if (motherParentalUsed + fatherParentalUsed > totalParentalPool) {
    errors.push({
      message: `Suma tygodni urlopu rodzicielskiego (${motherParentalUsed + fatherParentalUsed}) przekracza limit ${totalParentalPool} tyg.`,
      legalBasis: 'KP art. 182^1a',
    });
  }

  if (fatherParentalUsed > totalParentalPool - nonTransferable) {
    errors.push({
      message: `Jeden rodzic może wykorzystać maksymalnie ${totalParentalPool - nonTransferable} tyg. urlopu rodzicielskiego (${nonTransferable} tyg. przysługuje wyłącznie drugiemu rodzicowi).`,
      legalBasis: 'KP art. 182^1a § 4',
    });
  }

  if (motherParentalUsed > totalParentalPool - nonTransferable) {
    errors.push({
      message: `Jeden rodzic może wykorzystać maksymalnie ${totalParentalPool - nonTransferable} tyg. urlopu rodzicielskiego (${nonTransferable} tyg. przysługuje wyłącznie drugiemu rodzicowi).`,
      legalBasis: 'KP art. 182^1a § 4',
    });
  }

  if (paternityUsed > params.paternityLeave.weeks) {
    errors.push({
      message: `Wymiar urlopu ojcowskiego to maksymalnie ${params.paternityLeave.weeks} tygodnie.`,
      legalBasis: 'KP art. 182^3 § 1',
    });
  }

  const periods: LeavePeriod[] = parts.map((part) => {
    const base = part.parentRole === 'mother' ? motherBase : fatherBase;
    let rate = params.rates.parental;
    if (part.leaveType === 'paternityLeave') {
      rate = params.rates.paternity;
    } else if (scenario.rateVariant === 'combined') {
      rate =
        part.parentRole === 'father'
          ? params.rates.secondParentNonTransferableInCombined
          : params.rates.combined;
    }
    return buildPeriod(part.leaveType, part.parentRole, part.startDate, part.weeks, rate, base);
  });

  const totalLeft = Math.max(0, totalParentalPool - motherParentalUsed - fatherParentalUsed);
  const motherMax = Math.min(
    totalLeft,
    Math.max(0, totalParentalPool - nonTransferable - motherParentalUsed),
  );
  const fatherMax = Math.min(
    totalLeft,
    Math.max(0, totalParentalPool - nonTransferable - fatherParentalUsed),
  );

  return {
    valid: errors.length === 0,
    errors,
    periods,
    remainingWeeks: {
      mother: motherMax,
      father: fatherMax,
    },
  };
}

/**
 * Tymczasowa symulacja odpowiedzi /api/v1/plan/parental-with-work.
 */
export function buildDemoParentalWithWork(
  input: ParentalWithWorkInput,
  params: BenefitParams,
): ParentalWithWorkResult {
  const clampedFraction = Math.min(
    Math.max(input.workTimeFraction, 0.1),
    params.parentalLeave.maxWorkTimeFraction,
  );
  const baseDays = input.weeks * DAYS_IN_WEEK;
  const extendedDays = Math.min(Math.round(baseDays / (1 - clampedFraction)), baseDays * 2);
  const extendedWeeks = Math.floor(extendedDays / DAYS_IN_WEEK);
  const base =
    input.parentRole === 'mother'
      ? (input.scenario.mother.benefitBase ?? params.benefitBase.minimumWage)
      : (input.scenario.father?.benefitBase ?? params.benefitBase.minimumWage);

  const effectiveRate =
    (input.scenario.rateVariant === 'combined' && input.parentRole === 'mother'
      ? params.rates.combined
      : params.rates.parental) *
    (1 - clampedFraction);

  const period: LeavePeriod = {
    leaveType: 'parentalLeave',
    parentRole: input.parentRole,
    startDate: input.startDate,
    endDate: addDaysIso(input.startDate, extendedDays - 1),
    weeks: extendedWeeks,
    days: extendedDays,
    rate: roundPln(effectiveRate * 1000) / 1000,
    monthlyAmount: roundPln(base * effectiveRate),
    totalAmount: roundPln(((base * effectiveRate) / DAYS_IN_MONTH_APPROX) * extendedDays),
  };

  return {
    extendedWeeks,
    extendedDays,
    periods: [period],
    explanations: [
      {
        message: `Łączenie ${input.weeks} tyg. urlopu rodzicielskiego z pracą w wymiarze ${clampedFraction} etatu wydłuża okres do ${extendedDays} dni (${extendedWeeks} tyg.).`,
        legalBasis: 'KP art. 182^1e § 1–2',
      },
    ],
  };
}
