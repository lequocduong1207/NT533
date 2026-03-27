import { useEffect, useState } from 'react';
import { fetchNetworks } from '../api';

export default function NetworkPage({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchNetworks(token);
        if (mounted) {
          setItems(data || []);
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'Khong the tai du lieu network.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (loading) {
    return <p>Dang tai network...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  return (
    <section>
      <h2>Network</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((network) => (
            <tr key={network.id}>
              <td>{network.id}</td>
              <td>{network.name || '-'}</td>
              <td>{network.status || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
