import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { fetchCheckToken } from './api';
import NetworkPage from './pages/NetworkPage';
import ComputePage from './pages/ComputePage';

function LoginPage({ token, setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleLogin(event) {
    event.preventDefault();

    if (!username || !password) {
      setError('Vui long nhap username va password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await fetchCheckToken(username, password);

      if (result.status === 201 && result.token) {
        setToken(result.token);
        navigate('/network');
        return;
      }

      setError('Dang nhap that bai.');
    } catch (e) {
      setError(e.response?.data?.message || 'Sai tai khoan hoac mat khau.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleLogin}>
        <h1>Lab 2 Login</h1>
        <p className="sub">Dang nhap bang username/password de goi ham checkToken.</p>

        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Nhap username"
          autoComplete="off"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nhap password"
          autoComplete="off"
        />

        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Dang dang nhap...' : 'Dang nhap'}
        </button>

        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

function ProtectedLayout({ token, onLogout }) {
  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <header>
        <nav>
          <Link to="/network">Network</Link>
          <Link to="/compute">Compute</Link>
        </nav>
        <button type="button" className="btn" onClick={onLogout}>
          Logout
        </button>
      </header>

      <main>
        <Routes>
          <Route path="/network" element={<NetworkPage token={token} />} />
          <Route path="/compute" element={<ComputePage token={token} />} />
          <Route path="*" element={<Navigate to="/network" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState('');

  function handleLogout() {
    setToken('');
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage token={token} setToken={setToken} />} />
      <Route path="/*" element={<ProtectedLayout token={token} onLogout={handleLogout} />} />
    </Routes>
  );
}
