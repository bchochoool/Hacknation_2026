# Aplikacja ZUS Przewodnik

Aplikacja webowa i REST API projektu HackNation 2026. [README repozytorium](../README.md) zawiera szybki start i ręczny test fikcyjnej rodziny. Tutaj znajdziesz konfigurację środowiska i mapę modułów.

## 1. Uruchomienie

Polecenia wykonuj w `zus-przewodnik-starter`, gdzie znajduje się wspólny plik `package-lock.json`. Wymagania zespołu to Node.js 20 lub nowszy i npm 10 lub nowszy. Do wczytania `.env` użyj Node.js 20.12 lub nowszego. Repozytorium ma [`.nvmrc`](.nvmrc) wskazujący główną wersję 20.

```sh
npm ci
npm run dev
```

- Frontend Vite działa pod [`http://localhost:5173`](http://localhost:5173/).
- Express działa domyślnie na porcie `3001`. [`GET /api/v1/health`](http://localhost:3001/api/v1/health) zwraca `{"data":{"status":"ok"},"error":null}`.
- Vite przekazuje zapytania `/api` do Expressa przez proxy. Ten sam test działa przez [port frontendu](http://localhost:5173/api/v1/health).

Jeśli porty są zajęte, ustaw je w tej samej sesji terminala przed uruchomieniem. Vite odczytuje `PORT` i `VITE_PORT` ze środowiska procesu.

```powershell
$env:PORT = '3301'
$env:VITE_PORT = '5276'
npm run dev
```

`npm run start -w server` uruchamia samo API przez `tsx`. `npm run build` kompiluje projekt, a gotowe pliki Vite trafiają do `client/dist/`. [Wymagania i zależności](REQUIREMENTS.md)

## 2. Konfiguracja opcjonalna

Do podstawowego demo wystarczą ustawienia domyślne. Jeśli potrzebujesz ustawień serwera, skopiuj [`.env.example`](.env.example) do `.env` w `zus-przewodnik-starter`. W PowerShellu użyj `Copy-Item .env.example .env`.

| Zmienna | Zastosowanie |
| --- | --- |
| `PORT` | Port Expressa, domyślnie `3001`. Aby proxy Vite użyło tego samego portu, ustaw zmienną przed `npm run dev`. |
| `VITE_PORT` | Port serwera deweloperskiego Vite, domyślnie `5173`. |
| `CLIENT_ORIGIN` | Dodatkowy adres frontendu dozwolony przez CORS, np. `http://localhost:5276`. `http://localhost:5173` jest dozwolony domyślnie. |
| `ADMIN_TOKEN` | Token zapisu w `/admin`, co najmniej 32 znaki. Pusta wartość wyłącza zapis na serwerze. Zapisane parametry obowiązują do restartu API. |
| `GEMINI_API_KEY` | Opcjonalny klucz asystenta. Pusta wartość uruchamia odpowiedzi z lokalnej bazy demonstracyjnej. |
| `GEMINI_MODEL` | Opcjonalny identyfikator modelu. Domyślna wartość z przykładu to `gemini-3.1-flash-lite`. |
| `GEMINI_API_BASE_URL` | Opcjonalny bazowy adres usługi Gemini. W zwykłym uruchomieniu serwer używa domyślnego adresu adaptera. |

Wartości tokenów konfiguruj lokalnie. Plik `.env` pozostaje poza repozytorium.

## 3. Dane i źródła

- [`data/cases/`](data/cases/) zawiera sześć wymyślonych, ilustracyjnych spraw przykładowych (nie pochodzą z materiałów ZUS; wynik wzorcowy wylicza silnik aplikacji).
- [`data/profiles/`](data/profiles/) zawiera fikcyjne profile wykorzystywane przez symulację mObywatela i ZUS.
- Materiały konkursowe otrzymane od ZUS należą do lokalnego, ignorowanego `docs/zus/`. Surowe sprawy przechowuj poza Gitem w `data/cases-raw/`.

Oficjalne źródła to [serwis ZUS](https://www.zus.pl), [informacja o urlopie rodzicielskim](https://www.gov.pl/web/rodzina/urlop-rodzicielski), [porady PIP dotyczące rodzicielstwa](https://www.pip.gov.pl/dla-pracodawcow/porady-prawne/rodzicielstwo), [rejestr stanu cywilnego](https://www.gov.pl/web/cyfryzacja/rejestr-stanu-cywilnego) i [rozporządzenie dotyczące wniosków, Dz.U. 2025 poz. 322](https://dziennikustaw.gov.pl/DU/2025/322).

## 4. Moduły i przepływ danych

| Miejsce | Rola |
| --- | --- |
| [`client/`](client/) | React, formularz, plan, przewodnik, przykładowe sprawy i panel administracyjny. |
| [`server/`](server/) | Express, walidacja Zod i trasy pod `/api/v1`. Adaptery dostarczają fikcyjne dane logowania i ubezpieczenia. |
| [`shared/engine/`](shared/engine/) | Wspólny silnik uprawnień, obliczeń, okresów i checklist dokumentów. |
| [`shared/types.ts`](shared/types.ts) i [`shared/params.json`](shared/params.json) | Wspólny kontrakt oraz domyślne parametry obliczeń. |
| [`agents/`](agents/) | Instrukcje pracy i [konwencje API](agents/CONVENTIONS.md). |

Kreator przekazuje dane scenariusza do `POST /api/v1/plan`. Edycje planu i potwierdzone dane z importu PDF są w pamięci sesji karty (w tym po przeładowaniu). Opcja kopiowania linku w planie sprawy katalogowej udostępnia tylko jej publiczny identyfikator. Przy otwarciu starego linku aplikacja przenosi dane do sesji karty i usuwa parametr `inputs` z bieżącego adresu.

## 5. Ścieżki demonstracyjne

- [Kreator](client/src/features/wizard/README.md) zaczyna się od wybrania sytuacji na stronie startowej. Możesz go wypełnić ręcznie lub użyć danych z profilu testowego.
- `/plan` prowadzi do uprawnień, kalkulatora, planu urlopów, dokumentów, wniosków i wsparcia, a wspólny przycisk **Uwagi** w górnym pasku zbiera ostrzeżenia i ryzyka planu w jednym miejscu.
- `/cases` porównuje wyniki ze sprawami katalogowymi. Import własnego PDF próbuje odczytać pola w przeglądarce. Użytkownik sprawdza i zatwierdza wartości wysyłane do kalkulatora. W oficjalnych formularzach ZUS dane można uzupełnić ręcznie.
- `/login` symuluje mObywatela. `GET /api/v1/mock/profiles` zwraca listę profili, `POST /api/v1/mock/login` przyjmuje `{"profile_id":"anna"}`, a `GET /api/v1/mock/zus-data` używa tokenu z odpowiedzi logowania w nagłówku `Authorization: Bearer …`.
- `/guide` zawiera przewodnik po tematach, a `/admin` pozwala edytować parametry wersji demonstracyjnej. Podgląd i pobieranie wniosków są dostępne w planie. Informacje o adresacie prowadzą do właściwej ścieżki złożenia dokumentów.

### Panel administratora (`/admin`) w wersji demonstracyjnej

Panel pozwala zmienić stawki, wymiary urlopów i progi z `shared/params.json` bez zmian w kodzie.

1. Otwórz `/admin` (np. `https://splendorous-alfajores-228b93.netlify.app/admin`).
2. Zmień wybraną wartość, na przykład płacę minimalną.
3. Wpisz klucz dostępu w polu **ADMIN_TOKEN**: `demo-hacknation-2026-jkb3m-admin-token`.
4. Zapisz. Kalkulator i plan używają od razu nowych wartości.

Zapisane parametry obowiązują do restartu API. Na darmowym planie Render serwer usypia po bezczynności, więc po restarcie wracają wartości domyślne z `shared/params.json`.

**Uwaga o bezpieczeństwie.** Wiemy, że jawny token w dokumentacji to zła praktyka. Robimy tak tylko dlatego, że to wersja testowa z fikcyjnymi danymi, a jurorzy muszą móc sprawdzić panel bez dostępu do konfiguracji hostingu. We wdrożeniu produkcyjnym token ma być losowy, trzymany w zmiennych środowiskowych lub menedżerze sekretów, najlepiej zastąpiony logowaniem z rolami, a parametry zapisywane trwale z historią zmian.

## 6. Sprawdzenia

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` uruchamia Vitest w pakietach `shared`, `server` i `client`, w tym testy regresyjne `AUD-01–AUD-24`. Testy API wymagają lokalnych połączeń z `127.0.0.1`. Aby sprawdzić porównanie z decyzją w wybranej sprawie, otwórz ją w katalogu lub wyślij `POST /api/v1/cases/:caseId/evaluate`. [Audyt reguł i matryca spraw](../docs/test-cases.md) · [Raport weryfikacji E2E](docs/E2E_BUGI.md) · [Historia integracji](../docs/FIX_ALL_REPORT.md)

### Zakres obliczeń

- Kalkulator sygnalizuje brak obsługi macierzyńskiego i powiązanych urlopów przed 26.04.2023. Dla JDG wybiera próg zadłużenia według daty powstania prawa. W konfiguracji są wartości źródłowe dla lat 2025 i 2026. [Reforma](https://eli.gov.pl/eli/DU/2023/641/ogl) · [Płaca minimalna 2025](https://eli.gov.pl/eli/DU/2024/1362/ogl) · [Płaca minimalna 2026](https://eli.gov.pl/eli/DU/2025/1242/ogl)
- Przy adopcji podaj datę urodzenia dziecka i, dla ojcowskiego, datę uprawomocnienia przysposobienia. W razie hospitalizacji po przyjęciu potrzebne są także daty pobytu i tydzień ciąży przy porodzie. [ZUS o ojcowskim](https://bip.zus.pl/pl/web/guest/swiadczenia/zasilki/zasilek-macierzynski/prawo-do-zasilku-i-okres-przyslugiwania/za-okres-dodatkowego-urlopu-ojcowskiego) · [ZUS o urlopie uzupełniającym](https://bip.zus.pl/pl/web/guest/swiadczenia/zasilki/zasilek-macierzynski/prawo-do-zasilku-i-okres-przyslugiwania/za-okres-uzupelniajacego-urlopu-macierzynskiego)

## 7. Praca nad projektem

Pracuj na gałęzi zadania i wykonaj kontrole przed publikacją (`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`). Zmiany kontraktu opisuj w dzienniku zmian w [`agents/CONVENTIONS.md`](agents/CONVENTIONS.md). Materiały konkursowe, lokalną konfigurację i klucze przechowuj poza Gitem. [Kontrakt i konwencje](agents/CONVENTIONS.md) · [Instrukcje repozytorium](agents/AGENTS.md)

## 8. Licencje plików zewnętrznych

- Autorskie prawa majątkowe do kodu i materiałów wytworzonych w zadaniu podlegają zasadom § 4 Regulaminu Zadania Konkursowego HackNation 2026.
- [PDF.js](client/src/features/cases/vendor/README.md) zawiera informację o wydaniu i licencji Apache 2.0.
- Lato ma licencję SIL Open Font License. Kopie licencji są dołączone [do fontów interfejsu](client/public/fonts/OFL.txt) oraz [do zasobów generatora formularzy](client/public/forms/OFL-Lato.txt).

## 9. Funkcje AI

Asystent w zakładce **Wsparcie** jest oznaczony w interfejsie i może korzystać z Google Gemini po skonfigurowaniu klucza. Gdy serwer korzysta z lokalnej bazy odpowiedzi, API zwraca `is_demo_fallback: true`. Import pól PDF wykorzystuje PDF.js i reguły odczytu tekstu w przeglądarce.
