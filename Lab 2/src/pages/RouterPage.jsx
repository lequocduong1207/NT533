import { useEffect, useRef, useState } from 'react';
import {
  createRouter,
  deleteRouter,
  fetchRouters,
  fetchNetworks,
  fetchSubnets,
  addRouterInterface,
  removeRouterInterface
} from '../api/networks';

export default function RouterPage({ token }) {
  // Router Management
  const [routerId, setRouterId] = useState('');
  const [routers, setRouters] = useState([]);
  const [selectedRouterIds, setSelectedRouterIds] = useState([]);
  const [loadingRouters, setLoadingRouters] = useState(false);

  // Networks & Subnets
  const [networks, setNetworks] = useState([]);
  const [subnets, setSubnets] = useState([]);

  // Router Interfaces
  const [interfaces, setInterfaces] = useState([]);
  const [selectedSubnetId, setSelectedSubnetId] = useState('');
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);

  // Modals & Forms
  const [showCreateRouterModal, setShowCreateRouterModal] = useState(false);
  const [newRouterName, setNewRouterName] = useState('');
  const [newExternalNetworkId, setNewExternalNetworkId] = useState('');

  // UI State
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

  // Load networks on mount
  useEffect(() => {
    async function loadNetworks() {
      try {
        const data = await fetchNetworks(token);
        setNetworks(data || []);
      } catch (e) {
        console.error('Failed to load networks:', e);
      }
    }

    if (token) {
      loadNetworks();
    }
  }, [token]);

  // Load routers on mount
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
        showPopup('success', 'Tải danh sách router thành công.');
      }
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Không tải được danh sách router.');
    } finally {
      setLoadingRouters(false);
    }
  }

  useEffect(() => {
    loadRoutersList(false);
  }, [token]);

  const publicNetwork = networks.find(
    (n) => (n.name || '').toLowerCase() === 'public_net'
  );

  // Load interfaces when router changes
  useEffect(() => {
    async function loadInterfaces() {
      if (!routerId) {
        setInterfaces([]);
        setSelectedSubnetId('');
        return;
      }

      setLoadingInterfaces(true);
      try {
        const routerDetail = routers.find((r) => r.id === routerId);
        setInterfaces(routerDetail?.interfaces || []);
      } catch (e) {
        console.error('Failed to load interfaces:', e);
      } finally {
        setLoadingInterfaces(false);
      }
    }

    loadInterfaces();
  }, [routerId, routers]);

  // Load subnets when networks changes
  useEffect(() => {
    async function loadSubnets() {
      try {
        const allSubnets = [];
        for (const network of networks) {
          try {
            const subs = await fetchSubnets(token, network.id);
            allSubnets.push(...(subs || []));
          } catch (e) {
            console.error(`Failed to load subnets for network ${network.id}:`, e);
          }
        }
        setSubnets(allSubnets);
      } catch (e) {
        console.error('Failed to load subnets:', e);
      }
    }

    if (networks.length && token) {
      loadSubnets();
    }
  }, [networks, token]);

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
      showPopup('error', 'Vui lòng nhập tên router.');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        name: newRouterName.trim(),
        admin_state_up: true
      };

      if (publicNetwork || newExternalNetworkId.trim()) {
        payload.external_gateway_info = {
          network_id: newExternalNetworkId.trim() || publicNetwork?.id
        };
      }

      await createRouter(token, payload);
      await loadRoutersList(false);
      setNewRouterName('');
      setNewExternalNetworkId('');
      setShowCreateRouterModal(false);
      showPopup('success', 'Tạo router thành công.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Không tạo được router.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteSelectedRouters() {
    if (!selectedRouterIds.length) {
      showPopup('error', 'Vui lòng chọn router cần xóa.');
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

      showPopup('success', 'Xóa router thành công.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Không xóa được router.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleAddInterface() {
    if (!routerId) {
      showPopup('error', 'Vui lòng chọn router.');
      return;
    }

    if (!selectedSubnetId) {
      showPopup('error', 'Vui lòng chọn subnet.');
      return;
    }

    setProcessing(true);
    try {
      await addRouterInterface(token, routerId, {
        subnet_id: selectedSubnetId
      });

      await loadRoutersList(false);
      setSelectedSubnetId('');
      showPopup('success', 'Thêm interface thành công.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Không thêm được interface.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRemoveInterface(subnetId) {
    if (!routerId) {
      showPopup('error', 'Vui lòng chọn router.');
      return;
    }

    setProcessing(true);
    try {
      await removeRouterInterface(token, routerId, {
        subnet_id: subnetId
      });

      await loadRoutersList(false);
      showPopup('success', 'Xóa interface thành công.');
    } catch (e) {
      showPopup('error', e.response?.data?.message || 'Không xóa được interface.');
    } finally {
      setProcessing(false);
    }
  }

  const activeRouter = routers.find((r) => r.id === routerId);

  return (
    <section className="network-page">
      <h2>Router Management</h2>

      <div className="network-toolbar">
        <button
          type="button"
          className="btn primary"
          disabled={processing}
          onClick={() => {
            setNewExternalNetworkId(publicNetwork?.id || '');
            setShowCreateRouterModal(true);
          }}
        >
          Tạo mới Router
        </button>
        <button
          type="button"
          className="btn"
          disabled={processing || !selectedRouterIds.length}
          onClick={handleDeleteSelectedRouters}
        >
          Xóa Router Đã Chọn
        </button>
      </div>

      {/* Create Router Modal */}
      {showCreateRouterModal && (
        <div className="modal-overlay" onClick={() => setShowCreateRouterModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo Router Mới</h3>
              <button className="modal-close" onClick={() => setShowCreateRouterModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="router-name">Tên Router</label>
                <input
                  id="router-name"
                  type="text"
                  placeholder="Nhập tên router"
                  value={newRouterName}
                  onChange={(e) => setNewRouterName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="external-network">External Network</label>
                <select
                  id="external-network"
                  value={newExternalNetworkId}
                  onChange={(e) => setNewExternalNetworkId(e.target.value)}
                >
                  {!publicNetwork && <option value="">Không tìm thấy public_net</option>}
                  {publicNetwork && (
                    <option value={publicNetwork.id}>{publicNetwork.name}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn"
                onClick={() => setShowCreateRouterModal(false)}
              >
                Hủy
              </button>
              <button
                className="btn primary"
                disabled={processing}
                onClick={handleCreateRouter}
              >
                Tạo Router
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="network-layout">
        <div className="network-list">
          <table>
            <thead>
              <tr>
                <th>Chọn</th>
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

        <div className="network-detail">
          {!activeRouter && <p>Chọn một router để xem chi tiết và quản lý interface.</p>}

          {activeRouter && (
            <div className="detail-info">
              <h3>Chi tiết Router</h3>
              <p>
                <strong>Tên:</strong> {activeRouter.name || '-'}
              </p>
              <p>
                <strong>ID:</strong> {activeRouter.id}
              </p>
              <p>
                <strong>Trạng thái:</strong> {activeRouter.status || '-'}
              </p>
              <p>
                <strong>Admin State:</strong> {activeRouter.admin_state_up ? 'Up' : 'Down'}
              </p>
              <p>
                <strong>External Network:</strong> {activeRouter.external_gateway_info?.network_id || '-'}
              </p>

              <h4>Quản lý Interfaces</h4>
              
              <div className="inline-form subnet-form">
                <select
                  value={selectedSubnetId}
                  onChange={(e) => setSelectedSubnetId(e.target.value)}
                  disabled={loadingInterfaces}
                >
                  <option value="">Chọn subnet để thêm</option>
                  {subnets.map((subnet) => {
                    const isAlreadyAdded = interfaces.some((iface) => iface.subnet_id === subnet.id);
                    return (
                      <option key={subnet.id} value={subnet.id} disabled={isAlreadyAdded}>
                        {subnet.name || subnet.id}
                        {isAlreadyAdded ? ' (đã thêm)' : ''}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="btn primary"
                  disabled={processing || !selectedSubnetId}
                  onClick={handleAddInterface}
                >
                  Thêm Interface
                </button>
              </div>

              <h4>Các Interface Hiện Tại</h4>
              {loadingInterfaces && <p>Đang tải...</p>}
              {!loadingInterfaces && interfaces.length === 0 && <p>-</p>}
              {!loadingInterfaces && interfaces.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Subnet ID</th>
                      <th>Port ID</th>
                      <th>IP Address</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interfaces.map((iface) => (
                      <tr key={iface.subnet_id}>
                        <td>{iface.subnet_id}</td>
                        <td>{iface.port_id || '-'}</td>
                        <td>{iface.fixed_ips?.[0]?.ip_address || '-'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn small"
                            disabled={processing}
                            onClick={() => handleRemoveInterface(iface.subnet_id)}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {popup && (
        <div className={`notification notification-${popup.type}`}>
          <div className="notification-content">
            <span className="notification-icon">{popup.type === 'success' ? '✓' : '✕'}</span>
            <p className="notification-message">{popup.message}</p>
          </div>
        </div>
      )}
    </section>
  );
}