import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API, setToken } from '../lib/api';
import { toast } from '../components/Toast';

export default function Login() {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const trimmed = key.trim().toUpperCase();
    try {
      if (!trimmed || trimmed.length < 10) {
        throw new Error('Informe uma chave de licença válida.');
      }
      const res = await API.post<{ token: string; license?: { key: string } }>(
        '/api/v1/store/login-key',
        { key: trimmed },
      );
      setToken(res.token);
      if (res.license) localStorage.setItem('orion_last_key', res.license.key);
      toast('Bem-vindo!', 'ok');
      navigate(params.get('next') || '/conta');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Falha de autenticação.', 'err');
      setLoading(false);
    }
  }

  return (
    <div className="page-wrap">
      <div className="auth-wrap">
        <div id="mode-label">
          <h2>Acessar conta</h2>
          <p className="sub">Informe a chave de licença recebida na compra.</p>
        </div>

        <form id="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="key">Chave de licença</label>
            <input
              type="text"
              id="key"
              required
              autoComplete="off"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={29}
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              style={{
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Aguarde...' : 'Acessar'}
          </button>
        </form>

        <p className="auth-switch">
          Não tem uma licença? <Link to="/planos">Ver planos</Link>.
        </p>
        <p className="auth-switch" style={{ marginTop: 10 }}>
          Precisa de ajuda?{' '}
          <a href="https://discord.gg/e3jHfF7ANp" target="_blank" rel="noopener noreferrer">
            Discord
          </a>{' '}
          · <Link to="/suporte">Suporte</Link>
        </p>
      </div>
    </div>
  );
}
