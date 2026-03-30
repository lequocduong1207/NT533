import { useEffect, useRef, useState } from 'react';
import { createFloatingIp, deleteFloatingIp, fetchFloatingIps, updateFloatingIp } from '../api';

export default function FloatingPage({ token }) {
  const [floatingIps, setFloatingIps] = useState([]);
  const [floatingNetworkId, setFloatingNetworkId] = useState('');
  const [floatingPortId, setFloatingPortId] = useState('');
  const [editingFloatingId, setEditingFloatingId] = useState('');
  const [editingPortId, setEditingPortId] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [popup, setPopup] = useState(null);
  const popupTimeoutRef = useRef(null);

  function showPopup(type, message) {
    setPopup({ type, message });
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    popupTimeoutRef.current = setTimeout(() => {
      setPopup(null);
      popupTimeoutRef.current = null;
    }, 2500);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchFloatingIps(token);
        if (mounted) {
          setFloatingIps(data || []);
        }
      } catch (e) {
        if (mounted) {
          showPopup('error', e.response?.data?.message || 'Khong tai duoc floating IP.');
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
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, [token]);

  async function handleCreateFloatingIp() {
    if (!floatingNetworkId.trim()) {
      showPopup('error', 'Vui long nhap floating network ID.');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        floating_network_id: floatingNetworkId.trim()
      };

      if (floatingPortId.trim()) {
        payload.port_id = floatingPortId.trim();
      }

      const created = await createFloatingIp(token, payload);
      setFloatingIps((prev) => [created, ...prev]);
      setFloatingPortId('');
      showPopup('success', 'Tao floating IP thanh cong.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Khong tao duoc floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  function handleStartEditFloating(floatingIp) {
    setEditingFloatingId(floatingIp.id);
    setEditingPortId(floatingIp.port_id || '');
  }

  function handleCancelEditFloating() {
    setEditingFloatingId('');
    setEditingPortId('');
  }

  async function handleSaveFloatingIp() {
    if (!editingFloatingId) {
      return;
    }

    setProcessing(true);
    try {
      const updated = await updateFloatingIp(token, editingFloatingId, {
        port_id: editingPortId.trim() || null
      });
      setFloatingIps((prev) =>
        prev.map((item) => (item.id === editingFloatingId ? { ...item, ...updated } : item))
      );
      handleCancelEditFloating();
      showPopup('success', 'Cap nhat floating IP thanh cong.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Khong cap nhat duoc floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteFloatingIp(floatingIpId) {
    setProcessing(true);
    try {
      await deleteFloatingIp(token, floatingIpId);
      setFloatingIps((prev) => prev.filter((item) => item.id !== floatingIpId));
      if (editingFloatingId === floatingIpId) {
        handleCancelEditFloating();
      }
      showPopup('success', 'Xoa floating IP thanh cong.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Khong xoa duoc floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Dang tai floating IP...</p>;
  }

  return (
    <section className="network-page">
      <h2>Floating IP</h2>

      <div className="inline-form subnet-form">
        <input
          type="text"
          placeholder="Floating network ID"
          value={floatingNetworkId}
          onChange={(e) => setFloatingNetworkId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Port ID (optional)"
          value={floatingPortId}
          onChange={(e) => setFloatingPortId(e.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={processing}
          onClick={handleCreateFloatingIp}
        >
          Tao floating IP
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Floating IP</th>
            <th>Fixed IP</th>
            <th>Port ID</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {floatingIps.map((floatingIp) => (
            <tr key={floatingIp.id}>
              <td>{floatingIp.id}</td>
              <td>{floatingIp.floating_ip_address || '-'}</td>
              <td>{floatingIp.fixed_ip_address || '-'}</td>
              <td>
                {editingFloatingId === floatingIp.id ? (
                  <input
                    type="text"
                    placeholder="Port ID, de trong de bo gan"
                    value={editingPortId}
                    onChange={(e) => setEditingPortId(e.target.value)}
                  />
                ) : (
                  floatingIp.port_id || '-'
                )}
              </td>
              <td>{floatingIp.status || '-'}</td>
              <td>
                {editingFloatingId === floatingIp.id ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      disabled={processing}
                      onClick={handleSaveFloatingIp}
                    >
                      Luu
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={processing}
                      onClick={handleCancelEditFloating}
                    >
                      Huy
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn"
                      disabled={processing}
                      onClick={() => handleStartEditFloating(floatingIp)}
                    >
                      Sua Port
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={processing}
                      onClick={() => handleDeleteFloatingIp(floatingIp.id)}
                    >
                      Xoa
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {popup && (
        <div className={`popup-message popup-${popup.type}`}>
          <span>{popup.type === 'success' ? 'Thanh cong' : 'That bai'}</span>: {popup.message}
        </div>
      )}
    </section>
  );
}
