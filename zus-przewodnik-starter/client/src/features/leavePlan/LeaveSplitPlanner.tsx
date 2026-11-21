import { useMemo, useState, type FormEvent } from 'react';
import type {
  BenefitParams,
  LeavePartRequest,
  ParentalSplitResult,
  ParentalWithWorkResult,
  ParentRole,
  ScenarioInput,
} from '@shared/types';
import {
  addDaysIso,
  getLeaveTypeLabel,
  getMaternityEndDate,
  getParentalPoolSummary,
  getParentRoleLabel,
  getPartLimitInfo,
  LEAVE_PLAN_PRESETS,
  type LeavePlanPresetId,
} from './leavePlanMock';

interface LeaveSplitPlannerProps {
  scenario: ScenarioInput;
  params: BenefitParams;
  parts: LeavePartRequest[];
  activePreset: LeavePlanPresetId | null;
  splitResult: ParentalSplitResult | null;
  workByPartIndex: Record<number, number>;
  withWorkResults: Record<number, ParentalWithWorkResult>;
  onSelectPreset: (presetId: LeavePlanPresetId) => void;
  onAddPart: (part: LeavePartRequest) => void;
  onUpdatePart: (index: number, part: LeavePartRequest) => void;
  onRemovePart: (index: number) => void;
  onResetParts: () => void;
  onChangeWorkForPart: (partIndex: number, workTimeFraction: number | null) => void;
}

const dateFormatter = new Intl.DateTimeFormat('pl-PL');

function formatIsoPl(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

export function LeaveSplitPlanner({
  scenario,
  params,
  parts,
  activePreset,
  splitResult,
  workByPartIndex,
  withWorkResults,
  onSelectPreset,
  onAddPart,
  onUpdatePart,
  onRemovePart,
  onResetParts,
  onChangeWorkForPart,
}: LeaveSplitPlannerProps) {
  const pool = useMemo(() => getParentalPoolSummary(scenario, params), [scenario, params]);

  const suggestedNextStartDate = useMemo(() => {
    const maternityEnd = getMaternityEndDate(scenario, params);
    const parentalEnds = parts
      .filter((p) => p.leaveType === 'parentalLeave')
      .map((p) => addDaysIso(p.startDate, p.weeks * 7 - 1));
    const latestEnd = [maternityEnd, ...parentalEnds].sort().at(-1) ?? maternityEnd;
    return addDaysIso(latestEnd, 1);
  }, [parts, scenario, params]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<LeavePartRequest | null>(null);

  const [parentRole, setParentRole] = useState<ParentRole>('father');
  const [leaveType, setLeaveType] = useState<'parentalLeave' | 'paternityLeave'>('parentalLeave');
  const [dateMode, setDateMode] = useState<'auto' | 'custom'>('auto');
  const [customStartDate, setCustomStartDate] = useState<string>(suggestedNextStartDate);
  const [weeks, setWeeks] = useState<number>(params.parentalLeave.nonTransferableWeeksPerParent);

  const effectiveAddRole: ParentRole = leaveType === 'paternityLeave' ? 'father' : parentRole;
  const addLimit = useMemo(
    () => getPartLimitInfo(parts, effectiveAddRole, leaveType, scenario, params, null),
    [parts, effectiveAddRole, leaveType, scenario, params],
  );

  const effectiveEditRole: ParentRole =
    editDraft?.leaveType === 'paternityLeave' ? 'father' : (editDraft?.parentRole ?? 'mother');
  const editLimit = useMemo(() => {
    if (editingIndex === null || !editDraft) return null;
    return getPartLimitInfo(
      parts,
      effectiveEditRole,
      editDraft.leaveType === 'paternityLeave' ? 'paternityLeave' : 'parentalLeave',
      scenario,
      params,
      editingIndex,
    );
  }, [parts, editingIndex, editDraft, effectiveEditRole, scenario, params]);

  const clampedAddWeeks = addLimit.maxWeeks > 0 ? Math.min(weeks, addLimit.maxWeeks) : 0;
  const effectiveStartDate = dateMode === 'auto' ? suggestedNextStartDate : customStartDate;
  const previewEndDate =
    effectiveStartDate && clampedAddWeeks > 0
      ? addDaysIso(effectiveStartDate, clampedAddWeeks * 7 - 1)
      : null;

  const parentalPartEntries = parts
    .map((part, index) => ({ part, index }))
    .filter((entry) => entry.part.leaveType === 'parentalLeave');

  const motherUsedWeeks = parentalPartEntries
    .filter((entry) => entry.part.parentRole === 'mother')
    .reduce((sum, entry) => sum + entry.part.weeks, 0);
  const fatherUsedWeeks = parentalPartEntries
    .filter((entry) => entry.part.parentRole === 'father')
    .reduce((sum, entry) => sum + entry.part.weeks, 0);
  const totalUsedWeeks = motherUsedWeeks + fatherUsedWeeks;
  const poolPct = Math.min(100, Math.round((totalUsedWeeks / pool.totalWeeks) * 100));

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditDraft({ ...parts[index] });
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditDraft(null);
  }

  function saveEditing(event: FormEvent) {
    event.preventDefault();
    if (editingIndex === null || !editDraft || !editLimit) return;
    if (editDraft.weeks > editLimit.maxWeeks || editDraft.weeks < 1) return;
    onUpdatePart(editingIndex, {
      ...editDraft,
      parentRole: editDraft.leaveType === 'paternityLeave' ? 'father' : editDraft.parentRole,
    });
    setEditingIndex(null);
    setEditDraft(null);
  }

  function handleAddSubmit(event: FormEvent) {
    event.preventDefault();
    if (addLimit.maxPartsReached || addLimit.maxWeeks === 0) return;
    if (!effectiveStartDate || clampedAddWeeks < 1) return;
    onAddPart({
      parentRole: effectiveAddRole,
      leaveType,
      startDate: effectiveStartDate,
      weeks: clampedAddWeeks,
    });
  }

  const addBlocked = addLimit.maxPartsReached || addLimit.maxWeeks === 0;

  return (
    <section className="leave-card" aria-labelledby="planner-heading">
      <div className="leave-card__header">
        <div>
          <h2 id="planner-heading" className="leave-card__title">
            Zaplanuj lub zmień podział urlopu
          </h2>
          <p className="leave-card__lead">
            Wybierz gotowy scenariusz jednym kliknięciem albo dostosuj części ręcznie. Urlop
            rodzicielski możesz podzielić maksymalnie na {params.parentalLeave.maxParts} części. Po{' '}
            {pool.nonTransferable} tygodni przysługuje wyłącznie Matce i wyłącznie Ojcu (niewykorzystane
            przepadają).
          </p>
        </div>
        <button type="button" className="button button--secondary" onClick={onResetParts}>
          Przywróć propozycję startową
        </button>
      </div>

      {/* Gotowe scenariusze jednym kliknięciem */}
      <div className="presets-section" aria-labelledby="presets-heading">
        <h3 id="presets-heading" className="planner-subtitle">
          1. Wybierz gotowy scenariusz
        </h3>
        <div className="presets-grid">
          {LEAVE_PLAN_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={isSelected ? 'preset-card preset-card--active' : 'preset-card'}
                aria-pressed={isSelected}
                onClick={() => {
                  cancelEditing();
                  onSelectPreset(preset.id);
                }}
              >
                <span className="preset-card__title">{preset.title}</span>
                <span className="preset-card__desc">{preset.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wizualny pasek wykorzystanej puli tygodni */}
      <div className="pool-progress" aria-label="Wykorzystanie puli urlopu rodzicielskiego">
        <div className="pool-progress__top">
          <strong>
            Wykorzystano {totalUsedWeeks} z {pool.totalWeeks} tygodni urlopu rodzicielskiego
          </strong>
          <span className="pool-progress__breakdown">
            Mama: {motherUsedWeeks} tyg. · Tata: {fatherUsedWeeks} tyg.
          </span>
        </div>
        <div
          className="pool-progress__track"
          role="progressbar"
          aria-valuenow={totalUsedWeeks}
          aria-valuemin={0}
          aria-valuemax={pool.totalWeeks}
        >
          <div className="pool-progress__fill" style={{ width: `${poolPct}%` }} />
        </div>
      </div>

      {splitResult && !splitResult.valid && (
        <div className="planner-errors" role="alert">
          <h3 className="planner-errors__title">Sprawdź ograniczenia ustawowe:</h3>
          <ul>
            {splitResult.errors.map((err, idx) => (
              <li key={`${err.message}-${idx}`}>
                {err.message}
                {err.legalBasis && <span className="legal-basis"> ({err.legalBasis})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="planner-grid">
        <div>
          <h3 className="planner-subtitle">
            2. Części urlopu w planie — chronologicznie ({parentalPartEntries.length}/
            {params.parentalLeave.maxParts} części rodzicielskiego)
          </h3>

          <ul className="parts-list">
            {parts.map((part, index) => {
              const partEndDate = addDaysIso(part.startDate, part.weeks * 7 - 1);
              const isEditing = editingIndex === index && editDraft !== null;
              const workFrac = workByPartIndex[index];
              const workRes = withWorkResults[index];
              const isCombinedWithWork = Boolean(workFrac && workRes);

              if (isEditing && editDraft && editLimit) {
                const editExceeds = editDraft.weeks > editLimit.maxWeeks;
                return (
                  <li
                    key={`edit-${part.leaveType}-${part.startDate}-${index}`}
                    className="parts-item parts-item--editing"
                  >
                    <form className="parts-edit-form" onSubmit={saveEditing}>
                      <div className="planner-form__fields">
                        <label className="field">
                          <span>Rodzaj urlopu</span>
                          <select
                            value={editDraft.leaveType}
                            onChange={(e) => {
                              const nextType = e.target.value as
                                | 'parentalLeave'
                                | 'paternityLeave';
                              setEditDraft({
                                ...editDraft,
                                leaveType: nextType,
                                parentRole:
                                  nextType === 'paternityLeave' ? 'father' : editDraft.parentRole,
                              });
                            }}
                          >
                            <option value="parentalLeave">Urlop rodzicielski</option>
                            <option value="paternityLeave">Urlop ojcowski</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Kto bierze urlop</span>
                          <select
                            value={
                              editDraft.leaveType === 'paternityLeave'
                                ? 'father'
                                : editDraft.parentRole
                            }
                            disabled={editDraft.leaveType === 'paternityLeave'}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                parentRole: e.target.value as ParentRole,
                              })
                            }
                          >
                            <option value="mother">Matka</option>
                            <option value="father">Ojciec</option>
                          </select>
                        </label>

                        <label className="field">
                          <span>Data rozpoczęcia</span>
                          <input
                            type="date"
                            value={editDraft.startDate}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, startDate: e.target.value })
                            }
                            required
                          />
                        </label>

                        <div className="field">
                          <label htmlFor={`edit-weeks-${index}`}>Liczba tygodni</label>
                          <div className="stepper-row">
                            <button
                              type="button"
                              className="stepper-btn"
                              aria-label="Zmniejsz liczbę tygodni"
                              onClick={() =>
                                setEditDraft({
                                  ...editDraft,
                                  weeks: Math.max(1, editDraft.weeks - 1),
                                })
                              }
                            >
                              −1
                            </button>
                            <input
                              id={`edit-weeks-${index}`}
                              type="number"
                              min={1}
                              max={Math.max(1, editLimit.maxWeeks)}
                              value={editDraft.weeks}
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                setEditDraft({
                                  ...editDraft,
                                  weeks: Math.min(Math.max(1, raw), Math.max(1, editLimit.maxWeeks)),
                                });
                              }}
                              required
                            />
                            <button
                              type="button"
                              className="stepper-btn"
                              aria-label="Zwiększ liczbę tygodni"
                              disabled={editDraft.weeks >= editLimit.maxWeeks}
                              onClick={() =>
                                setEditDraft({
                                  ...editDraft,
                                  weeks: Math.min(editLimit.maxWeeks, editDraft.weeks + 1),
                                })
                              }
                            >
                              +1
                            </button>
                          </div>
                        </div>
                      </div>

                      {editLimit.limitReason && (
                        <p
                          className={
                            editDraft.weeks >= editLimit.maxWeeks || editExceeds
                              ? 'limit-notice limit-notice--warn'
                              : 'limit-notice'
                          }
                          role={editExceeds ? 'alert' : undefined}
                        >
                          {editDraft.weeks >= editLimit.maxWeeks
                            ? `Wykorzystano limit: ${editLimit.limitReason}`
                            : editLimit.limitReason}
                        </p>
                      )}

                      <div className="parts-edit-form__actions">
                        <button
                          type="submit"
                          className="button button--primary"
                          disabled={editExceeds || editLimit.maxWeeks === 0}
                        >
                          Zapisz zmiany
                        </button>
                        <button
                          type="button"
                          className="button button--secondary"
                          onClick={cancelEditing}
                        >
                          Anuluj
                        </button>
                      </div>
                    </form>
                  </li>
                );
              }

              return (
                <li
                  key={`${part.leaveType}-${part.parentRole}-${part.startDate}-${index}`}
                  className="parts-item"
                >
                  <div>
                    <strong>{getParentRoleLabel(part.parentRole)}</strong> –{' '}
                    {getLeaveTypeLabel(part.leaveType)}
                    {isCombinedWithWork && (
                      <span className="parts-item__work-tag">
                        + praca ({workFrac === 0.25 ? '1/4' : '1/2'} etatu)
                      </span>
                    )}
                    <div className="parts-item__meta">
                      {formatIsoPl(part.startDate)} – {formatIsoPl(partEndDate)} · {part.weeks} tyg.
                      {isCombinedWithWork && workRes && (
                        <> → z pracą: {workRes.extendedWeeks} tyg.</>
                      )}
                    </div>
                  </div>
                  <div className="parts-item__actions">
                    <button
                      type="button"
                      className="parts-item__edit"
                      onClick={() => startEditing(index)}
                      aria-label={`Edytuj część: ${getParentRoleLabel(part.parentRole)}, ${getLeaveTypeLabel(part.leaveType)}`}
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      className="parts-item__remove"
                      onClick={() => {
                        if (editingIndex === index) cancelEditing();
                        onRemovePart(index);
                      }}
                      aria-label={`Usuń część: ${getParentRoleLabel(part.parentRole)}, ${getLeaveTypeLabel(part.leaveType)}`}
                    >
                      Usuń
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <form className="planner-form" onSubmit={handleAddSubmit}>
            <h4 className="planner-form__title">Dostosuj ręcznie: dodaj kolejną część</h4>
            <div className="planner-form__fields">
              <label className="field">
                <span>Rodzaj urlopu</span>
                <select
                  value={leaveType}
                  onChange={(e) => {
                    const nextType = e.target.value as 'parentalLeave' | 'paternityLeave';
                    setLeaveType(nextType);
                    if (nextType === 'paternityLeave') {
                      setParentRole('father');
                      setWeeks(params.paternityLeave.minPartWeeks);
                    }
                  }}
                >
                  <option value="parentalLeave">Urlop rodzicielski</option>
                  <option value="paternityLeave">Urlop ojcowski</option>
                </select>
              </label>

              <label className="field">
                <span>Kto bierze urlop</span>
                <select
                  value={effectiveAddRole}
                  disabled={leaveType === 'paternityLeave'}
                  onChange={(e) => setParentRole(e.target.value as ParentRole)}
                >
                  <option value="mother">Matka</option>
                  <option value="father">Ojciec</option>
                </select>
              </label>

              <div className="field field--full">
                <span>Kiedy ma się zacząć?</span>
                <div className="date-mode-group">
                  <label className="radio-inline">
                    <input
                      type="radio"
                      name="partDateMode"
                      checked={dateMode === 'auto'}
                      onChange={() => setDateMode('auto')}
                    />
                    <span>
                      Zaraz po poprzednim urlopie ({formatIsoPl(suggestedNextStartDate)})
                    </span>
                  </label>
                  <label className="radio-inline">
                    <input
                      type="radio"
                      name="partDateMode"
                      checked={dateMode === 'custom'}
                      onChange={() => {
                        setCustomStartDate(suggestedNextStartDate);
                        setDateMode('custom');
                      }}
                    />
                    <span>Wybieram własną datę</span>
                  </label>
                </div>
                {dateMode === 'custom' && (
                  <input
                    type="date"
                    aria-label="Własna data rozpoczęcia"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    required
                  />
                )}
              </div>

              <div className="field field--full">
                <label htmlFor="part-weeks-input">Liczba tygodni</label>
                <div className="stepper-row">
                  <button
                    type="button"
                    className="stepper-btn"
                    aria-label="Zmniejsz o 1 tydzień"
                    disabled={addBlocked || clampedAddWeeks <= 1}
                    onClick={() => setWeeks(Math.max(1, clampedAddWeeks - 1))}
                  >
                    −1
                  </button>
                  <input
                    id="part-weeks-input"
                    type="number"
                    min={addBlocked ? 0 : 1}
                    max={Math.max(1, addLimit.maxWeeks)}
                    disabled={addBlocked}
                    value={clampedAddWeeks}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      setWeeks(Math.min(Math.max(1, raw), Math.max(1, addLimit.maxWeeks)));
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    aria-label="Zwiększ o 1 tydzień"
                    disabled={addBlocked || clampedAddWeeks >= addLimit.maxWeeks}
                    onClick={() => setWeeks(Math.min(addLimit.maxWeeks, clampedAddWeeks + 1))}
                  >
                    +1
                  </button>
                </div>
              </div>
            </div>

            {addLimit.limitReason && (
              <p
                className={
                  addBlocked || clampedAddWeeks >= addLimit.maxWeeks
                    ? 'limit-notice limit-notice--warn'
                    : 'limit-notice'
                }
                role={addBlocked ? 'status' : undefined}
              >
                {addBlocked
                  ? `Nie można dodać więcej: ${addLimit.limitReason}`
                  : clampedAddWeeks >= addLimit.maxWeeks
                    ? `Maksimum dla tej części: ${addLimit.limitReason}`
                    : addLimit.limitReason}
              </p>
            )}

            {previewEndDate && !addBlocked && (
              <p className="planner-preview">
                Ten urlop potrwa od <strong>{formatIsoPl(effectiveStartDate)}</strong> do{' '}
                <strong>{formatIsoPl(previewEndDate)}</strong> ({clampedAddWeeks} tyg.).
              </p>
            )}

            <button type="submit" className="button button--primary" disabled={addBlocked}>
              Dodaj część do planu
            </button>
          </form>
        </div>

        {/* Sekcja 3: niezależnie dla części Matki i Ojca */}
        <div className="work-combine-box">
          <h3 className="planner-subtitle">
            3. Praca w trakcie urlopu rodzicielskiego (dla Matki i Ojca)
          </h3>
          <p className="work-combine-box__lead">
            Zarówno Mama, jak i Tata mogą w trakcie swojej części urlopu rodzicielskiego wrócić do
            pracy na część etatu (dotyczy tylko urlopu rodzicielskiego). Praca wydłuża czas trwania
            urlopu w kalendarzu, ale <strong>nie zabiera tygodni</strong> z puli drugiego rodzica.
          </p>

          {parentalPartEntries.length === 0 ? (
            <p className="work-combine-box__empty">
              Dodaj najpierw część urlopu rodzicielskiego po lewej stronie, aby włączyć łączenie z
              pracą.
            </p>
          ) : (
            <div className="work-parts-list">
              {parentalPartEntries.map(({ part, index }) => {
                const selectedFraction = workByPartIndex[index] ?? null;
                const workRes = withWorkResults[index];
                const originalEnd = addDaysIso(part.startDate, part.weeks * 7 - 1);

                return (
                  <div key={`work-card-${index}`} className="planner-form work-part-card">
                    <label className="field">
                      <span>
                        {getParentRoleLabel(part.parentRole)} · od {formatIsoPl(part.startDate)} (
                        {part.weeks} tyg.)
                      </span>
                      <select
                        aria-label={`Praca w trakcie urlopu: ${getParentRoleLabel(part.parentRole)} od ${formatIsoPl(part.startDate)}`}
                        value={selectedFraction === null ? '' : String(selectedFraction)}
                        onChange={(e) => {
                          const val = e.target.value;
                          onChangeWorkForPart(index, val === '' ? null : Number(val));
                        }}
                      >
                        <option value="">Pełny urlop (nie pracuję)</option>
                        <option value="0.25">
                          Praca 1/4 etatu (~2 godz./dzień) → urlop dłuższy o ok. 1/3
                        </option>
                        <option value="0.5">
                          Praca 1/2 etatu (~4 godz./dzień) → urlop dłuższy nawet 2×
                        </option>
                      </select>
                    </label>

                    {selectedFraction !== null && workRes && (
                      <div className="work-result" aria-live="polite">
                        <p>
                          <strong>Bez pracy:</strong> {part.weeks} tyg. (do{' '}
                          {formatIsoPl(originalEnd)})
                        </p>
                        <p>
                          <strong>Z pracą na {selectedFraction === 0.25 ? '1/4' : '1/2'} etatu:</strong>{' '}
                          {workRes.extendedWeeks} tyg. ({workRes.extendedDays} dni, do{' '}
                          {formatIsoPl(workRes.periods[0]?.endDate ?? part.startDate)})
                        </p>
                        <p className="work-result__note">
                          Okres pracy został oznaczony na osi czasu i w kalendarzu powyżej.
                          Dostajesz część pensji z pracy oraz proporcjonalnie obniżony zasiłek.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
