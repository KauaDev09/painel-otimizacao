import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Checkout from './pages/Checkout';
import Conta from './pages/Conta';
import DownloadPage from './pages/Download';
import Home from './pages/Home';
import Login from './pages/Login';
import Planos from './pages/Planos';
import Privacidade from './pages/Privacidade';
import Sucesso from './pages/Sucesso';
import Suporte from './pages/Suporte';
import Termos from './pages/Termos';

const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="admin/*"
          element={
            <Suspense
              fallback={
                <div style={{ padding: 40, color: '#e8eef7', background: '#070b12', minHeight: '100vh' }}>
                  Carregando admin…
                </div>
              }
            >
              <AdminApp />
            </Suspense>
          }
        />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="planos" element={<Planos />} />
          <Route path="download" element={<DownloadPage />} />
          <Route path="login" element={<Login />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="conta" element={<Conta />} />
          <Route path="sucesso" element={<Sucesso />} />
          <Route path="suporte" element={<Suporte />} />
          <Route path="termos" element={<Termos />} />
          <Route path="privacidade" element={<Privacidade />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
