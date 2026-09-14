import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DukaPortal from '@/pages/DukaPortal';
import { SaasPlansProvider } from '@/context/SaasPlansContext';
import { useOfflineStore } from '@/stores';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function OfflineListener() {
  const { setOnline } = useOfflineStore();
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [setOnline]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OfflineListener />
        <Routes>
          <Route path="/*" element={<SaasPlansProvider><DukaPortal /></SaasPlansProvider>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
