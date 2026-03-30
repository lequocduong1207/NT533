import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { fetchCheckToken } from './api';
import NetworkPage from './pages/NetworkPage';
import ComputePage from './pages/ComputePage';
import KeypairManager from './pages/KeypairManager';
import SecurityGroupManager from './pages/SecurityGroupManager';
import FloatingIPManager from './pages/FloatingIPManager';
import RouterPage from './pages/RouterPage';

const TOKEN_STORAGE_KEY = 'lab2_auth_token';

function LoginPage({ token, setToken }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (token) {
    return <Navigate to="/network" replace />;
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (!username || !password) {
      setError('Vui lòng nhập username và password.');
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

      setError('Đăng nhập thất bại.');
    } catch (e) {
      setError(e.response?.data?.message || 'Sai tài khoản hoặc mật khẩu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleLogin}>
        <h1>Login</h1>

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
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

function ProtectedLayout({ token, onLogout }) {
  const location = useLocation();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <h2>Resources</h2>
        <nav>
          <div className="nav-group">
            <p>Compute</p>
            <Link
              className={location.pathname.startsWith('/compute/instance') ? 'active' : ''}
              to="/compute/instance"
            >
              Instance
            </Link>
            <Link
              className={location.pathname.startsWith('/compute/flavor') ? 'active' : ''}
              to="/compute/flavor"
            >
              Flavor
            </Link>
            <Link
              className={location.pathname.startsWith('/compute/image') ? 'active' : ''}
              to="/compute/image"
            >
              Image
            </Link>
            <Link
              className={location.pathname.startsWith('/compute/keypair') ? 'active' : ''}
              to="/compute/keypair"
            >
              Keypair
            </Link>
          </div>

          <div className="nav-group">
            <p>Network Management</p>
            <Link className={location.pathname === '/network' ? 'active' : ''} to="/network">
              Network
            </Link>
            <Link className={location.pathname === '/network/router' ? 'active' : ''} to="/network/router">
              Router
            </Link>
            <Link
              className={location.pathname.startsWith('/network/security-group') ? 'active' : ''}
              to="/network/security-group"
            >
              Security Group
            </Link>
            <Link
              className={location.pathname.startsWith('/network/floating-ip') ? 'active' : ''}
              to="/network/floating-ip"
            >
              Floating IP
            </Link>
          </div>
        </nav>
        <button type="button" className="btn" onClick={onLogout}>
          Đăng xuất
        </button>
      </aside>

      <main className="content-panel">
        <Routes>
          <Route path="/network" element={<NetworkPage token={token} />} />
          <Route path="/floating" element={<FloatingPage token={token} />} />
          <Route path="/router" element={<RouterPage token={token} />} />
          <Route path="/compute/flavor" element={<ComputePage token={token} view="flavor" />} />
          <Route path="/compute/instance" element={<ComputePage token={token} view="instance" />} />
          <Route path="/compute/image" element={<ComputePage token={token} view="image" />} />
          <Route path="/compute/keypair" element={<KeypairManager token={token} />} />
          <Route path="/network/security-group" element={<SecurityGroupManager token={token} />} />
          <Route path="/network/floating-ip" element={<FloatingIPManager token={token} />} />
          <Route path="/network/router" element={<RouterPage token={token} />} />
          <Route path="/compute" element={<Navigate to="/compute/flavor" replace />} />
          <Route path="*" element={<Navigate to="/network" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      return;
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, [token]);

  function handleLogout() {
    setToken('');
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage token={token} setToken={setToken} />} />
      <Route path="/*" element={<ProtectedLayout token={token} onLogout={handleLogout} />} />
    </Routes>
  );
}
