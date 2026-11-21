import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PlaceholderPage } from '../components/PlaceholderPage';
import { DocumentsPage } from '../features/documents/DocumentsPage';
import { LandingPage } from '../features/landing/LandingPage';

function PlanRouter() {
  const { tab } = useParams<{ tab?: string }>();
  if (tab === 'documents' || !tab) {
    return <DocumentsPage />;
  }
  return <PlaceholderPage />;
}

/** Routing zgodny z CONVENTIONS §7. */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PlaceholderPage />} />
      <Route path="/wizard" element={<PlaceholderPage />} />
      <Route path="/plan" element={<DocumentsPage />} />
      <Route path="/plan/:tab" element={<PlanRouter />} />
      <Route path="/documents" element={<Navigate to="/plan/documents" replace />} />
      <Route path="/guide" element={<PlaceholderPage />} />
      <Route path="/guide/:slug" element={<PlaceholderPage />} />
      <Route path="/cases" element={<PlaceholderPage />} />
      <Route path="/cases/:caseId" element={<PlaceholderPage />} />
      <Route path="/admin" element={<PlaceholderPage />} />
      <Route path="*" element={<PlaceholderPage />} />
    </Routes>
  );
}
