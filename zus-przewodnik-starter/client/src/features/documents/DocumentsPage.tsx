import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DocumentChecklist, InsuranceTitle, RateVariant, ScenarioInput, SituationType } from '@shared/types';
import { apiPost } from '../../api/client';
import { useScenario } from '../../app/ScenarioContext';
import './DocumentsPage.css';

const STORAGE_KEY = 'zus_documents_checklist_state';

export function DocumentsPage() {
  const { scenario } = useScenario();

  // Konfiguracja sytuacji
  const [situation, setSituation] = useState<SituationType>(scenario.situation ?? 'afterBirth');
  const [eventDate, setEventDate] = useState<string>('2026-11-01');
  const [insuranceTitle, setInsuranceTitle] = useState<InsuranceTitle>('employment');
  const [isLargeEmployer, setIsLargeEmployer] = useState<boolean>(true);
  const [rateVariant, setRateVariant] = useState<RateVariant>('combined');
  const [zaZyciem, setZaZyciem] = useState<boolean>(false);
  const [hospitalization, setHospitalization] = useState<boolean>(false);
  const [fatherLeave, setFatherLeave] = useState<boolean>(true);

  // Dane z API
  const [checklist, setChecklist] = useState<DocumentChecklist | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stan odhaczonych dokumentów (zapisany w localStorage)
  const [checkedIds, setCheckedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Zbudowanie ScenarioInput do wywołania API
  const scenarioPayload: ScenarioInput = useMemo(() => {
    const isAdoption = situation === 'adoption';
    return {
      situation,
      referenceDate: '2026-11-21',
      expectedBirthDate: situation === 'pregnant' ? eventDate : null,
      birthDate: situation === 'afterBirth' ? eventDate : null,
      childrenCount: 1,
      adoptionType: isAdoption ? 'adoption' : null,
      childAcceptanceDate: isAdoption ? eventDate : null,
      childAgeYears: isAdoption ? 2 : null,
      schoolObligationDeferred: false,
      rateVariant,
      mother: {
        role: 'mother',
        insuranceTitle,
        sicknessInsurance: insuranceTitle === 'selfEmployed' ? 'voluntary' : 'mandatory',
        insuredSince: '2025-01-01',
        insuranceEndDate: null,
        benefitBase: 6000,
        employerInsuredCount: insuranceTitle === 'employment' ? (isLargeEmployer ? 25 : 15) : null,
        age: 30,
        contributionDebt: null,
        wantsLeave: true,
      },
      father: fatherLeave
        ? {
            role: 'father',
            insuranceTitle: 'employment',
            sicknessInsurance: 'mandatory',
            insuredSince: '2025-01-01',
            insuranceEndDate: null,
            benefitBase: 8000,
            employerInsuredCount: 25,
            age: 32,
            contributionDebt: null,
            wantsLeave: true,
          }
        : null,
      special: {
        zaZyciemCertificate: zaZyciem,
        pregnancyWeekAtBirth: hospitalization ? 27 : null,
        birthWeightGrams: hospitalization ? 950 : null,
        hospitalizationDays: hospitalization ? 28 : null,
        stillbirth: false,
        childDeathDate: null,
        motherHospitalized: false,
        motherIncapableOfIndependentLiving: false,
        motherDeceased: false,
        employerBankruptcyOrLiquidation: false,
      },
    };
  }, [
    situation,
    eventDate,
    insuranceTitle,
    isLargeEmployer,
    rateVariant,
    zaZyciem,
    hospitalization,
    fatherLeave,
  ]);

  // Pobieranie checklisty z backendu
  useEffect(() => {
    let cancelled = false;

    apiPost<DocumentChecklist>('/documents', scenarioPayload)
      .then((data) => {
        if (!cancelled) {
          setChecklist(data);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Nie udało się pobrać checklisty.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scenarioPayload]);

  // Zapisywanie stanu checkboxów do localStorage
  function toggleDocument(id: string) {
    setCheckedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignoruj błędy zapisu
      }
      return next;
    });
  }

  function handleReset() {
    setCheckedIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignoruj
    }
  }

  const totalDocs = checklist?.documents.length ?? 0;
  const completedDocs = checklist?.documents.filter((d) => checkedIds.includes(d.id)).length ?? 0;
  const progressPercent = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

  return (
    <div className="documents-page">
      <header className="documents-page__header">
        <div className="documents-page__container">
          <nav className="documents-page__nav" aria-label="Nawigacja">
            <Link to="/" className="documents-page__back-link">
              ← Wróć do strony głównej
            </Link>
          </nav>
          <h1 className="documents-page__title">Dokumenty i terminy</h1>
          <p className="documents-page__subtitle">
            Indywidualna checklista formalności: dowiedz się, jakie wnioski złożyć, gdzie i w jakim terminie.
          </p>
        </div>
      </header>

      <main className="documents-page__main">
        <div className="documents-page__container">
          <div className="documents-page__grid">
            {/* Lewa kolumna: Szybki konfigurator sytuacji */}
            <aside className="situation-card">
              <h2 className="situation-card__title">Twoja sytuacja</h2>

              <div className="form-group">
                <label htmlFor="situation-select" className="form-label">
                  Etap:
                </label>
                <select
                  id="situation-select"
                  className="form-select"
                  value={situation}
                  onChange={(e) => setSituation(e.target.value as SituationType)}
                >
                  <option value="afterBirth">Po porodzie (dziecko urodzone)</option>
                  <option value="pregnant">W ciąży (przed porodem)</option>
                  <option value="adoption">Adopcja / rodzina zastępcza</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="event-date" className="form-label">
                  {situation === 'adoption'
                    ? 'Data przyjęcia dziecka:'
                    : situation === 'pregnant'
                      ? 'Przewidywana data porodu:'
                      : 'Data urodzenia dziecka:'}
                </label>
                <input
                  id="event-date"
                  type="date"
                  className="form-input"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="insurance-title" className="form-label">
                  Forma zatrudnienia:
                </label>
                <select
                  id="insurance-title"
                  className="form-select"
                  value={insuranceTitle}
                  onChange={(e) => setInsuranceTitle(e.target.value as InsuranceTitle)}
                >
                  <option value="employment">Umowa o pracę (etat)</option>
                  <option value="selfEmployed">Działalność gospodarcza (JDG)</option>
                  <option value="mandateContract">Umowa zlecenie</option>
                </select>
              </div>

              {insuranceTitle === 'employment' && (
                <div className="form-group">
                  <label className="form-label">Wielkość pracodawcy:</label>
                  <select
                    className="form-select"
                    value={isLargeEmployer ? 'large' : 'small'}
                    onChange={(e) => setIsLargeEmployer(e.target.value === 'large')}
                  >
                    <option value="large">Powyżej 20 ubezpieczonych (płaci pracodawca)</option>
                    <option value="small">Do 20 ubezpieczonych (płaci ZUS)</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Wariant wniosku:</label>
                <select
                  className="form-select"
                  value={rateVariant}
                  onChange={(e) => setRateVariant(e.target.value as RateVariant)}
                >
                  <option value="combined">Długi wniosek (81,5% za cały okres)</option>
                  <option value="standard">Standardowy (100% macierzyński + 70% rodzicielski)</option>
                </select>
              </div>

              <div className="form-group">
                <span className="form-label">Okoliczności szczególne:</span>
                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={zaZyciem}
                    onChange={(e) => setZaZyciem(e.target.checked)}
                  />
                  Zaświadczenie „Za życiem”
                </label>

                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={hospitalization}
                    onChange={(e) => setHospitalization(e.target.checked)}
                  />
                  Wcześniak lub hospitalizacja noworodka
                </label>

                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={fatherLeave}
                    onChange={(e) => setFatherLeave(e.target.checked)}
                  />
                  Drugi rodzic korzysta z urlopu / ojcowskiego
                </label>
              </div>
            </aside>

            {/* Prawa kolumna: Dokumenty, terminy, płatnik */}
            <div className="documents-content">
              {/* Baner płatnika */}
              {checklist && (
                <div className="payer-banner" role="region" aria-label="Informacja o płatniku świadczenia">
                  <div className="payer-banner__header">
                    <span
                      className={`payer-banner__badge ${
                        checklist.payer === 'employer'
                          ? 'payer-banner__badge--employer'
                          : 'payer-banner__badge--zus'
                      }`}
                    >
                      Płatnik: {checklist.payer === 'employer' ? 'Pracodawca' : 'ZUS'}
                    </span>
                    <h3 className="payer-banner__title">
                      {checklist.payer === 'employer'
                        ? 'Zasiłek wypłaca Twój pracodawca'
                        : 'Zasiłek wypłaca bezpośrednio ZUS'}
                    </h3>
                  </div>
                  <p className="payer-banner__desc">
                    {checklist.payer === 'employer'
                      ? 'Ponieważ pracodawca zgłasza do ubezpieczenia powyżej 20 osób (art. 61 ustawy zasiłkowej), wszystkie wnioski składasz w kadrach pracodawcy, a świadczenie otrzymasz wraz z pensją.'
                      : 'Wnioski składasz bezpośrednio do ZUS (najwygodniej przez portal PUE/eZUS lub mObywatela). Pracodawca/zleceniodawca przekazuje do ZUS zaświadczenie płatnika (Z-3 / Z-3a).'}
                  </p>
                </div>
              )}

              {/* Karta postępu */}
              <div className="progress-card">
                <div className="progress-card__header">
                  <span>Postęp skompletowania dokumentów</span>
                  <span>
                    {completedDocs} z {totalDocs} ({progressPercent}%)
                  </span>
                </div>
                <div className="progress-card__bar-bg">
                  <div className="progress-card__bar-fill" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              {/* Ważne terminy */}
              {checklist && checklist.deadlines.length > 0 && (
                <section className="deadlines-section">
                  <h2 className="section-title">Kluczowe terminy</h2>
                  <div className="deadlines-grid">
                    {checklist.deadlines.map((deadline, idx) => (
                      <div key={idx} className="deadline-card">
                        <div className="deadline-card__date">{deadline.date}</div>
                        <div className="deadline-card__label">{deadline.label}</div>
                        {deadline.legalBasis && (
                          <div className="deadline-card__basis">Podstawa: {deadline.legalBasis}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Checklista dokumentów */}
              <section className="documents-section">
                <h2 className="section-title">Lista dokumentów do złożenia</h2>

                {loading && <p>Wczytywanie aktualnych dokumentów...</p>}
                {error && <p className="error-text">Błąd: {error}</p>}

                {checklist && (
                  <div className="documents-list">
                    {checklist.documents.map((doc) => {
                      const isChecked = checkedIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          className={`doc-card ${isChecked ? 'doc-card--checked' : ''}`}
                        >
                          <div className="doc-card__checkbox-wrapper">
                            <input
                              type="checkbox"
                              id={`doc-${doc.id}`}
                              className="form-checkbox"
                              checked={isChecked}
                              onChange={() => toggleDocument(doc.id)}
                            />
                          </div>
                          <div className="doc-card__content">
                            <div className="doc-card__header">
                              <label htmlFor={`doc-${doc.id}`} className="doc-card__name">
                                {doc.name}
                              </label>
                              <span
                                className={`badge ${
                                  doc.submitTo === 'employer' ? 'badge--employer' : 'badge--zus'
                                }`}
                              >
                                Gdzie: {doc.submitTo === 'employer' ? 'Pracodawca' : 'ZUS'}
                              </span>
                            </div>
                            {doc.deadline && (
                              <p className="doc-card__deadline">
                                <strong>Termin:</strong> do {doc.deadline}
                              </p>
                            )}
                            {doc.note && <p className="doc-card__note">{doc.note}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="documents-actions">
                  <button type="button" className="btn btn--primary" onClick={() => window.print()}>
                    🖨️ Drukuj checklistę
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={handleReset}>
                    Wyczyść zaznaczenia
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
