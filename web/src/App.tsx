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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
