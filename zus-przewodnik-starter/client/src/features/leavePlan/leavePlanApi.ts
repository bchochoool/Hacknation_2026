import type {
  BenefitParams,
  MaternityCalculationResult,
  ParentalSplitInput,
  ParentalSplitResult,
  ParentalWithWorkInput,
  ParentalWithWorkResult,
  ScenarioInput,
} from '@shared/types';
import { ApiError, apiGet, apiPost } from '../../api/client';
import {
  buildDemoMaternityPeriods,
  buildDemoParentalSplit,
  buildDemoParentalWithWork,
  DEFAULT_BENEFIT_PARAMS,
} from './leavePlanMock';

export interface ApiResultWithFallback<T> {
  data: T;
  isDemoFallback: boolean;
}

function isFallbackableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'NOT_FOUND' || error.code === 'INTERNAL_ERROR';
  }
  return true;
}

export async function fetchBenefitParams(): Promise<ApiResultWithFallback<BenefitParams>> {
  try {
    const data = await apiGet<BenefitParams>('/params');
    return { data, isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      return { data: DEFAULT_BENEFIT_PARAMS, isDemoFallback: true };
    }
    throw error;
  }
}

export async function calculateMaternityPlan(
  scenario: ScenarioInput,
  params: BenefitParams,
): Promise<ApiResultWithFallback<MaternityCalculationResult>> {
  try {
    const data = await apiPost<MaternityCalculationResult>('/calculate/maternity', scenario);
    return { data, isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      return { data: buildDemoMaternityPeriods(scenario, params), isDemoFallback: true };
    }
    throw error;
  }
}

export async function requestParentalSplit(
  input: ParentalSplitInput,
  params: BenefitParams,
): Promise<ApiResultWithFallback<ParentalSplitResult>> {
  try {
    const data = await apiPost<ParentalSplitResult>('/plan/parental-split', input);
    return { data, isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      return { data: buildDemoParentalSplit(input, params), isDemoFallback: true };
    }
    throw error;
  }
}

export async function requestParentalWithWork(
  input: ParentalWithWorkInput,
  params: BenefitParams,
): Promise<ApiResultWithFallback<ParentalWithWorkResult>> {
  try {
    const data = await apiPost<ParentalWithWorkResult>('/plan/parental-with-work', input);
    return { data, isDemoFallback: false };
  } catch (error) {
    if (isFallbackableError(error)) {
      return { data: buildDemoParentalWithWork(input, params), isDemoFallback: true };
    }
    throw error;
  }
}
