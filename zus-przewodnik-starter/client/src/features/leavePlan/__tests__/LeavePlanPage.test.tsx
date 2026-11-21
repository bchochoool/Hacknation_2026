import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScenarioProvider } from '../../../app/ScenarioContext';
import { LeavePlanPage } from '../LeavePlanPage';

function renderLeavePlan(initialEntry = '/plan/leave-plan') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ScenarioProvider>
        <Routes>
          <Route path="/plan" element={<LeavePlanPage />} />
          <Route path="/plan/:tab" element={<LeavePlanPage />} />
        </Routes>
      </ScenarioProvider>
    </MemoryRouter>,
  );
  return { user };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LeavePlanPage', () => {
  it('renders plan heading, tabs, rate switcher, timeline, monthly calendar and split planner', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    renderLeavePlan();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Twój plan urlopów' }),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Plan urlopów' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Oś czasu urlopów/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Kalendarz miesięczny' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Zaplanuj lub zmień podział urlopu/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/danych demonstracyjnych/i)).toBeInTheDocument();
  });

  it('allows switching rate variant and applying preset split scenarios including only Father', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderLeavePlan();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tylko Tata/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /100% macierzyński \+ 70% rodzicielski/i }));
    expect(screen.getByText(/100% \+ 70%/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tylko Tata/i }));
    await waitFor(() => {
      expect(screen.getByText(/Mama: 0 tyg\. · Tata: 32 tyg\./i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Po połowie/i }));
    await waitFor(() => {
      expect(screen.getByText(/Mama: 21 tyg\. · Tata: 20 tyg\./i)).toBeInTheDocument();
    });
  });

  it('allows editing an existing leave part inline and enforces limits', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderLeavePlan();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Edytuj część/i }).length).toBeGreaterThan(0);
    });

    // Na start w klasycznym planie pula 41 tyg. jest pełna, więc dodanie nowej części jest zablokowane komunikatem limitu.
    expect(screen.getByRole('button', { name: 'Dodaj część do planu' })).toBeDisabled();
    expect(screen.getByText(/Nie można dodać więcej:/i)).toBeInTheDocument();

    // Edytujemy część Matki (zmniejszamy o 1 tydzień, a przycisk +1 powinien być zablokowany przez limit 32 tyg.).
    await user.click(screen.getAllByRole('button', { name: /Edytuj część/i })[1]);
    expect(screen.getByRole('button', { name: 'Zwiększ liczbę tygodni' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Zmniejsz liczbę tygodni' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));

    await waitFor(() => {
      expect(screen.getByText(/Mama: 31 tyg\./i)).toBeInTheDocument();
    });
  });

  it('keeps planned parts sorted chronologically when adding an earlier part', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderLeavePlan();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tylko Mama/i })).toBeInTheDocument();
    });

    // Wybieramy "Tylko Mama" (32 tyg. od 2027-03-30, zostaje 9 tyg. dla Taty).
    await user.click(screen.getByRole('button', { name: /Tylko Mama/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Dodaj część do planu' })).toBeEnabled();
    });

    // Dodajemy część Ojca z wcześniejszą datą niż część Matki.
    await user.selectOptions(screen.getByLabelText('Kto bierze urlop'), 'father');
    await user.click(screen.getByLabelText('Wybieram własną datę'));
    const dateInput = screen.getByLabelText('Własna data rozpoczęcia');
    await user.clear(dateInput);
    await user.type(dateInput, '2026-12-01');
    await user.click(screen.getByRole('button', { name: 'Dodaj część do planu' }));

    await waitFor(() => {
      const items = screen.getAllByRole('button', { name: /Edytuj część/i });
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveAttribute('aria-label', expect.stringContaining('Ojciec'));
      expect(items[1]).toHaveAttribute('aria-label', expect.stringContaining('Matka'));
    });
  });

  it('allows navigating months, quick-jumping and selecting a day in the monthly calendar', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderLeavePlan();

    await waitFor(() => {
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    const initialGridLabel = screen.getByRole('grid').getAttribute('aria-label');
    await user.click(screen.getByRole('button', { name: 'Start rodzicielskiego' }));
    const jumpedGridLabel = screen.getByRole('grid').getAttribute('aria-label');
    expect(jumpedGridLabel).not.toBe(initialGridLabel);

    const dayButtons = screen
      .getByRole('grid')
      .querySelectorAll<HTMLButtonElement>('button.calendar-day');
    expect(dayButtons.length).toBeGreaterThan(20);

    await user.click(dayButtons[9]);
    expect(screen.getByText(/Szczegóły dla dnia:/i)).toBeInTheDocument();

    // Po przejściu na inny miesiąc szczegóły wybranego dnia zamykają się.
    await user.click(screen.getByRole('button', { name: 'Następny miesiąc' }));
    expect(screen.queryByText(/Szczegóły dla dnia:/i)).not.toBeInTheDocument();

    // Kliknięcie terminu złożenia wniosku przenosi kalendarz i otwiera opis, co trzeba złożyć.
    await user.click(
      screen.getByRole('button', { name: /Wniosek o 81,5% za cały urlop/i }),
    );
    expect(screen.getByText(/Termin złożenia wniosku:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ostatni dzień na złożenie wniosku/i)).toBeInTheDocument();
  });

  it('allows both Mother and Father to combine parental leave with work and shows work on timeline', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { user } = renderLeavePlan();

    await waitFor(() => {
      expect(screen.getAllByLabelText(/Praca w trakcie urlopu:/i)).toHaveLength(2);
    });

    const workSelects = screen.getAllByLabelText(/Praca w trakcie urlopu:/i);
    await user.selectOptions(workSelects[0], '0.5');
    await user.selectOptions(workSelects[1], '0.25');

    await waitFor(() => {
      expect(screen.getByText(/Z pracą na 1\/2 etatu:/i)).toBeInTheDocument();
      expect(screen.getByText(/Z pracą na 1\/4 etatu:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Urlop rodzicielski \+ praca 1\/2 etatu/i).length).toBeGreaterThan(
        0,
      );
      expect(screen.getAllByText(/Urlop rodzicielski \+ praca 1\/4 etatu/i).length).toBeGreaterThan(
        0,
      );
    });
  });
});
