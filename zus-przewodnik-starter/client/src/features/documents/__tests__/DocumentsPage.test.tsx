import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentChecklist } from '@shared/types';
import { ScenarioProvider } from '../../../app/ScenarioContext';
import { DocumentsPage } from '../DocumentsPage';

const mockChecklist: DocumentChecklist = {
  payer: 'employer',
  documents: [
    {
      id: 'birthCertificateShort',
      name: 'Skrócony odpis aktu urodzenia dziecka',
      submitTo: 'employer',
      deadline: '2026-11-22',
      note: 'Odpis z USC',
    },
    {
      id: 'applicationToEmployer',
      name: 'Wniosek o urlop macierzyński i rodzicielski',
      submitTo: 'employer',
      deadline: '2026-11-22',
      note: 'Wniosek w kadrach',
    },
  ],
  deadlines: [
    {
      label: 'Termin na wniosek 81,5%',
      date: '2026-11-22',
      legalBasis: 'Ustawa zasiłkowa art. 30a',
    },
  ],
};

function mockFetch(data: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data, error: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('DocumentsPage', () => {
  it('renders documents checklist and deadlines from API', async () => {
    mockFetch(mockChecklist);

    render(
      <MemoryRouter>
        <ScenarioProvider>
          <DocumentsPage />
        </ScenarioProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Dokumenty i terminy' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Skrócony odpis aktu urodzenia dziecka')).toBeInTheDocument();
      expect(screen.getByText('Wniosek o urlop macierzyński i rodzicielski')).toBeInTheDocument();
    });

    expect(screen.getByText('Zasiłek wypłaca Twój pracodawca')).toBeInTheDocument();
    expect(screen.getByText('Termin na wniosek 81,5%')).toBeInTheDocument();
  });

  it('allows toggling document checkboxes and updates progress', async () => {
    mockFetch(mockChecklist);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ScenarioProvider>
          <DocumentsPage />
        </ScenarioProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Skrócony odpis aktu urodzenia dziecka')).toBeInTheDocument();
    });

    expect(screen.getByText('0 z 2 (0%)')).toBeInTheDocument();

    const firstCheckbox = screen.getByRole('checkbox', { name: 'Skrócony odpis aktu urodzenia dziecka' });
    await user.click(firstCheckbox);

    expect(firstCheckbox).toBeChecked();
    expect(screen.getByText('1 z 2 (50%)')).toBeInTheDocument();
  });
});
