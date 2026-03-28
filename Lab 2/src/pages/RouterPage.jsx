import { useEffect, useRef, useState } from 'react';
import { createRouter, deleteRouter, fetchRouters } from '../api';

export default function RouterPage({ token }) {
  const [routerId, setRouterId] = useState('');
  const [routers, setRouters] = useState([]);
  const [selectedRouterIds, setSelectedRouterIds] = useState([]);
  const [newRouterName, setNewRouterName] = useState('');
  const [newExternalNetworkId, setNewExternalNetworkId] = useState('');
  const [loadingRouters, setLoadingRouters] = useState(false);
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
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  async function loadRoutersList(showSuccessMessage = false) {
    setLoadingRouters(true);
    try {
      const data = await fetchRouters(token);
      const routerList = data || [];
      setRouters(routerList);
      setSelectedRouterIds((prev) => prev.filter((id) => routerList.some((router) => router.id === id)));

      if (!routerId && routerList.length) {
        setRouterId(routerList[0].id);
      }

      if (routerId && !routerList.some((router) => router.id === routerId)) {
        setRouterId(routerList[0]?.id || '');
      }

      if (showSuccessMessage) {
        showPopup('success', 'Tai danh sach router thanh cong.');
      }
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Khong tai duoc danh sach router.');
    } finally {
      setLoadingRouters(false);
    }
  }

  useEffect(() => {
    loadRoutersList(false);
  }, [token]);

  function toggleRouterSelection(id, checked) {
    setSelectedRouterIds((prev) => {
      if (checked) {
        if (prev.includes(id)) {
          return prev;
        }
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

  async function handleCreateRouter() {
    if (!newRouterName.trim()) {
      showPopup('error', 'Vui long nhap ten router.');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        name: newRouterName.trim(),
        admin_state_up: true
      };

      if (newExternalNetworkId.trim()) {
        payload.external_gateway_info = {
          network_id: newExternalNetworkId.trim()
        };
      }

      const created = await createRouter(token, payload);
      await loadRoutersList(false);
      setRouterId(created?.id || routerId);
      setNewRouterName('');
      setNewExternalNetworkId('');
      showPopup('success', 'Tao router thanh cong.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Khong tao duoc router.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteSelectedRouters() {
    if (!selectedRouterIds.length) {
      showPopup('error', 'Vui long chon router can xoa.');
      return;
    }

    setProcessing(true);
    try {
      await Promise.all(selectedRouterIds.map((id) => deleteRouter(token, id)));
      const removed = new Set(selectedRouterIds);
      setSelectedRouterIds([]);
      await loadRoutersList(false);

      if (removed.has(routerId)) {
        setRouterId('');
      }

      showPopup('success', 'Xoa router thanh cong.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Khong xoa duoc router.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="network-page">
      <h2>Router Management</h2>

      <div className="network-toolbar">
        <select value={routerId} onChange={(e) => setRouterId(e.target.value)}>
          {!routers.length && <option value="">Khong co router</option>}
          {routers.map((router) => (
            <option key={router.id} value={router.id}>
              {(router.name && `${router.name} - `) || ''}
              {router.id}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Router ID"
          value={routerId}
          onChange={(e) => setRouterId(e.target.value)}
        />
        <button type="button" className="btn" disabled={loadingRouters} onClick={() => loadRoutersList(true)}>
          {loadingRouters ? 'Dang tai routers...' : 'Reload Routers'}
        </button>
      </div>

      <div className="network-detail">
        <div className="inline-form subnet-form">
          <input
            type="text"
            placeholder="Ten router moi"
            value={newRouterName}
            onChange={(e) => setNewRouterName(e.target.value)}
          />
          <input
            type="text"
            placeholder="External network ID (optional)"
            value={newExternalNetworkId}
            onChange={(e) => setNewExternalNetworkId(e.target.value)}
          />
          <button type="button" className="btn primary" disabled={processing} onClick={handleCreateRouter}>
            Them Router
          </button>
          <button
            type="button"
            className="btn"
            disabled={processing || !selectedRouterIds.length}
            onClick={handleDeleteSelectedRouters}
          >
            Xoa Router Da Chon
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Chon</th>
              <th>ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>External Network</th>
            </tr>
          </thead>
          <tbody>
            {routers.map((router) => (
              <tr
                key={router.id}
                className={router.id === routerId ? 'row-active' : ''}
                onClick={() => setRouterId(router.id)}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedRouterIds.includes(router.id)}
                    onChange={(e) => toggleRouterSelection(router.id, e.target.checked)}
                  />
                </td>
                <td>{router.id}</td>
                <td>{router.name || '-'}</td>
                <td>{router.status || '-'}</td>
                <td>{router.external_gateway_info?.network_id || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {popup && (
        <div className={`popup-message popup-${popup.type}`}>
          <span>{popup.type === 'success' ? 'Thanh cong' : 'That bai'}</span>: {popup.message}
        </div>
      )}
    </section>
  );
}
