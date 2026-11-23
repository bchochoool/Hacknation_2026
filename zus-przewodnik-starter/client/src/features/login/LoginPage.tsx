import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type {
  ApplicantRole,
  AuthSession,
  InsuranceTitle,
  MockProfileSummary,
} from '@shared/types';
import { apiGet, apiPost } from '../../api/client';
import { DEFAULT_PARAMS } from '../../app/benefitParams';
import { useScenario } from '../../app/ScenarioContext';
import { parseSituation } from '../../app/situation';
import { AppBar } from '../../components/AppBar';
import { AppFooter, type FooterLink } from '../../components/AppFooter';
import { ArrowIcon } from '../../components/icons';
import { formatPln, formatPolishDate } from '../plan/planScenario';
import { computeAverageIncome, resolveRightArisesDate } from '../wizard/zusMerge';
import { ContributionDebtCertificate, SickLeavePreview } from './ZusSimulationPanels';
import '../wizard/WizardPage.css';
import './LoginPage.css';

const TITLE_LABELS: Record<InsuranceTitle, string> = {
  employment: 'Umowa o pracę',
  mandateContract: 'Umowa zlecenie',
  selfEmployed: 'Działalność gospodarcza (JDG)',
  none: 'Brak tytułu ubezpieczenia',
};

const FOOTER_LINKS: FooterLink[] = [
  { to: '/guide', label: 'Przewodnik' },
  { to: '/cases', label: 'Przykładowe sprawy' },
];

const applicantOptions = [
  { role: 'MOTHER', label: 'Mama' },
  { role: 'FATHER', label: 'Tata' },
] as const;

export function LoginPage() {
  const {
    scenario,
    manualForm,
    authSession,
    loginWithProfile,
    logoutMockSession,
    setSimulatedIdentity,
  } = useScenario();
  const [query] = useSearchParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const locationState = state as { returnTo?: unknown; applicantRoles?: unknown } | null;
  const requestedRoles = locationState?.applicantRoles;
  const availableApplicants = Array.isArray(requestedRoles)
    ? applicantOptions.filter(({ role }) => requestedRoles.includes(role))
    : applicantOptions;

  const [selectedRole, setSelectedRole] = useState<ApplicantRole | null>(null);
  const role = selectedRole ?? availableApplicants[0]?.role;

  const [profiles, setProfiles] = useState<MockProfileSummary[] | null>(null);
  const [waking, setWaking] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const profileId = selectedProfile || profiles?.[0]?.profileId || '';
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(false);

  const situation = parseSituation(query.get('situation')) ?? scenario.situation;
  const rawReturnTo = locationState?.returnTo;
  const returnTo =
    typeof rawReturnTo === 'string' &&
    /^\/(?:plan\/applications|wizard)(?:\?.*)?$/.test(rawReturnTo)
      ? rawReturnTo
      : situation
        ? `/wizard?situation=${situation}`
        : '/';
  const isApplicationIdentityFlow = returnTo.startsWith('/plan/applications');

  useEffect(() => {
    mounted.current = true;
    let active = true;
    // Hosting demo bywa uśpiony – pierwsze zapytanie może się nie udać, więc ponawiamy kilka razy.
    const MAX_ATTEMPTS = 8;
    const RETRY_DELAY_MS = 5000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (attempt: number) => {
      void apiGet<MockProfileSummary[]>('/mock/profiles')
        .then((items) => {
          if (!active) return;
          setWaking(false);
          setProfiles(items);
          if (!items.length) setError('Brak dostępnych profili testowych.');
        })
        .catch(() => {
          if (!active) return;
          if (attempt < MAX_ATTEMPTS) {
            setWaking(true);
            timer = setTimeout(() => load(attempt + 1), RETRY_DELAY_MS);
            return;
          }
          setWaking(false);
          setProfiles([]);
          setError('Nie udało się pobrać profili testowych.');
        });
    };
    load(1);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      mounted.current = false;
    };
  }, []);

  async function connectApplicantIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || !profileId || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await apiPost<AuthSession>('/mock/login', { profile_id: profileId });
      if (!mounted.current) return;
      setSimulatedIdentity(role, result);
      navigate(returnTo, { replace: true });
    } catch {
      if (!mounted.current) return;
      setError('Nie udało się zalogować. Spróbuj ponownie.');
      setSubmitting(false);
    }
  }

  async function handleProfileLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await loginWithProfile(profileId, situation);
    } catch (err) {
      if (!mounted.current) return;
      setError(
        err instanceof Error ? err.message : 'Nie udało się zalogować wybranym profilem.',
      );
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }

  const conflictCount = Object.keys(manualForm?.pendingConflicts ?? {}).length;
  const activeMother = authSession?.profile.mother ?? null;
  const averageIncome = authSession ? computeAverageIncome(authSession.zusData.incomes) : null;
  const rightArisesDate = resolveRightArisesDate(scenario, manualForm?.answers);

  const backAction = (
    <Link to={returnTo} className="ui-btn ui-btn--ghost ui-btn--sm">
      ← Wróć
    </Link>
  );

  if (isApplicationIdentityFlow) {
    return (
      <div className="wizard login-page">
        <header>
          <AppBar isStatic actions={backAction} />
        </header>
        <main id="main" tabIndex={-1} className="wizard__shell wizard__main">
          <form className="wizard__card" onSubmit={connectApplicantIdentity}>
            <h1>Logowanie przez mObywatela (symulacja)</h1>
            <p className="wizard__help">
              Wybierz gotowy profil testowy. Imię, nazwisko, PESEL i data urodzenia zostaną
              przeniesione do danych wnioskodawcy.
            </p>
            <div className="wizard__input-group">
              <label className="wizard__field">
                Wnioskodawca
                <select
                  value={role ?? ''}
                  disabled={submitting || availableApplicants.length < 2}
                  onChange={(event) => {
                    const applicant = availableApplicants.find(
                      (candidate) => candidate.role === event.target.value,
                    );
                    if (applicant) setSelectedRole(applicant.role);
                  }}
                >
                  {availableApplicants.map(({ role: optRole, label }) => (
                    <option key={optRole} value={optRole}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wizard__field">
                Profil testowy
                <select
                  value={profileId}
                  disabled={!profileId || submitting}
                  onChange={(event) => setSelectedProfile(event.target.value)}
                >
                  {!profileId && (
                    <option value="">{profiles === null ? 'Wczytywanie…' : 'Brak profili'}</option>
                  )}
                  {profiles?.map((profile) => (
                    <option key={profile.profileId} value={profile.profileId}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <p className="wizard__error" role="alert">
                {error}
              </p>
            )}
            <div className="wizard__actions wizard__actions--split">
              <Link
                className="ui-btn ui-btn--ghost wizard__button wizard__button--secondary"
                to={returnTo}
              >
                Kontynuuj bez logowania
              </Link>
              <button
                className="ui-btn ui-btn--cta wizard__button wizard__button--primary"
                type="submit"
                disabled={!role || !profileId || submitting}
              >
                {submitting ? 'Pobieranie danych…' : 'Przekaż dane testowe'}
              </button>
            </div>
          </form>
        </main>
        <AppFooter links={FOOTER_LINKS} />
      </div>
    );
  }

  return (
    <div className="wizard login-page">
      <header>
        <AppBar isStatic actions={backAction} />
      </header>

      <main id="main" tabIndex={-1} className="wizard__shell wizard__main">
        <div className="wizard__intro">
          <span className="wizard__situation">Symulacja · bez prawdziwych danych</span>
          <h1 className="wizard__title">Logowanie przez mObywatela (symulacja)</h1>
          <p className="wizard__subtitle">
            Wybierz profil demonstracyjny, aby pobrać symulowane dane z ZUS (ubezpieczenie,
            miesięczne zarobki, e-ZLA z kodem „B” i stan zadłużenia). W formularzu uzupełnimy
            wyłącznie puste pola — bez nadpisywania Twoich wpisów.
          </p>
        </div>

        <div className="login-page__stack">
          <section className="wizard__card" aria-labelledby="mock-login-heading">
            <h2 id="mock-login-heading">Wybierz profil mObywatela (symulacja)</h2>

            {profiles === null && (
              <div className="login-page__loading">
                <p role="status">
                  {waking
                    ? 'Budzimy serwer demonstracyjny – to potrwa do minuty. Nie odświeżaj strony…'
                    : 'Ładowanie profili demonstracyjnych…'}
                </p>
                <span className="ui-skeleton login-page__skeleton" />
                <span className="ui-skeleton login-page__skeleton" />
              </div>
            )}
            {error && profiles !== null && profiles.length === 0 && (
              <p className="wizard__notice" role="status">
                {error}
              </p>
            )}

            {profiles && profiles.length > 0 && (
              <form onSubmit={handleProfileLogin} className="login-page__stack">
                <fieldset className="wizard__choices">
                  <legend className="visually-hidden">Profile demonstracyjne mObywatel</legend>
                  {profiles.map((item, index) => {
                    const checked = profileId === item.profileId;
                    return (
                      <label
                        key={item.profileId}
                        className={
                          checked ? 'wizard__choice wizard__choice--selected' : 'wizard__choice'
                        }
                        style={{ ['--i' as string]: index }}
                      >
                        <input
                          type="radio"
                          name="mockProfile"
                          value={item.profileId}
                          checked={checked}
                          onChange={() => setSelectedProfile(item.profileId)}
                        />
                        <span className="wizard__choice-label">{item.label}</span>
                      </label>
                    );
                  })}
                </fieldset>

                {error && (
                  <p className="wizard__error" role="alert">
                    {error}
                  </p>
                )}

                <div className="wizard__actions wizard__actions--split">
                  <Link
                    className="ui-btn ui-btn--ghost wizard__button wizard__button--secondary"
                    to={returnTo}
                  >
                    Kontynuuj bez logowania
                  </Link>
                  <button
                    type="submit"
                    className="ui-btn ui-btn--cta wizard__button wizard__button--primary"
                    disabled={!profileId || submitting}
                  >
                    {submitting
                      ? 'Pobieranie danych z ZUS…'
                      : 'Zaloguj przez mObywatela (symulacja)'}
                  </button>
                </div>
              </form>
            )}
          </section>

          {authSession && activeMother && (
            <section className="wizard__card" aria-labelledby="zus-session-heading">
              <div className="login-page__session-header">
                <h2 id="zus-session-heading">
                  Pobrano dane z ZUS: {authSession.profile.firstName}{' '}
                  {authSession.profile.lastName}
                </h2>
                <button type="button" className="wizard__edit" onClick={logoutMockSession}>
                  Wyloguj profil demo
                </button>
              </div>

              <dl className="login-page__session-summary">
                <div>
                  <dt>Tytuł ubezpieczenia (ZUS)</dt>
                  <dd>{TITLE_LABELS[activeMother.insuranceTitle]}</dd>
                </div>
                {activeMother.insuredSince && (
                  <div>
                    <dt>Początek ubezpieczenia (ZUS)</dt>
                    <dd>{formatPolishDate(activeMother.insuredSince)}</dd>
                  </div>
                )}
                {activeMother.employerInsuredCount !== null && (
                  <div>
                    <dt>Osoby zgłoszone u płatnika (ZUS)</dt>
                    <dd>{activeMother.employerInsuredCount}</dd>
                  </div>
                )}
                {averageIncome !== null && (
                  <div>
                    <dt>
                      Średni przychód z ostatnich {authSession.zusData.incomes.length} mies. (ZUS)
                    </dt>
                    <dd>{formatPln(averageIncome)}</dd>
                  </div>
                )}
              </dl>

              {conflictCount > 0 && (
                <p className="wizard__notice" role="status">
                  Wykryto {conflictCount === 1 ? '1 rozbieżność' : `${conflictCount} rozbieżności`}{' '}
                  z wcześniej wpisanymi odpowiedziami. Twoje wpisy nie zostały nadpisane —
                  zdecydujesz o nich w formularzu.
                </p>
              )}

              {activeMother.insuranceTitle === 'selfEmployed' && (
                <ContributionDebtCertificate
                  payerName={`${authSession.profile.firstName} ${authSession.profile.lastName}`}
                  asOfDate={rightArisesDate}
                  contributionDebt={authSession.zusData.contributionDebt}
                  params={DEFAULT_PARAMS}
                />
              )}

              <SickLeavePreview certificates={authSession.zusData.sickLeaveCertificates} />

              <div className="wizard__actions wizard__actions--end">
                <button
                  type="button"
                  className="ui-btn ui-btn--cta ui-btn--lg wizard__button wizard__button--primary"
                  onClick={() => navigate(returnTo, { replace: true })}
                >
                  Przejdź do formularza z danymi ZUS <ArrowIcon />
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <AppFooter links={FOOTER_LINKS} />
    </div>
  );
}
