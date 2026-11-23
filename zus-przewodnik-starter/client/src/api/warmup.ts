import { API_BASE_URL } from './client';

/**
 * Wersja demonstracyjna działa na hostingu, który usypia API po bezczynności (pierwsze zapytanie
 * trwa nawet minutę). Pusty ping przy starcie aplikacji budzi serwer, zanim użytkownik dojdzie do
 * kroku wymagającego API. Błędy są celowo ignorowane.
 */
export function warmUpApi(): void {
  try {
    void fetch(`${API_BASE_URL}/health`, { cache: 'no-store' }).catch(() => undefined);
  } catch {
    /* brak fetch lub tryb offline */
  }
}
