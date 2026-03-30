import { useEffect, useState } from 'react';
import {
  fetchFloatingIPs,
  fetchNetworks,
  createFloatingIP,
  deleteFloatingIP,
  fetchPorts,
  updateFloatingIP
} from '../api/networks';
import { fetchServers } from '../api/computes';

export default function FloatingIPManager({ token }) {
  const [floatingIPs, setFloatingIPs] = useState([]);
  const [servers, setServers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form states
  const [newFloatingIPNetwork, setNewFloatingIPNetwork] = useState('');
  const [floatingNetworks, setFloatingNetworks] = useState([]);
  const [defaultFloatingNetworkId, setDefaultFloatingNetworkId] = useState('');
  const [selectedFloatingIP, setSelectedFloatingIP] = useState(null);
  const [selectedServerId, setSelectedServerId] = useState('');

  // Load floating IPs and servers
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [fipsData, serversData, networksData] = await Promise.all([
          fetchFloatingIPs(token),
          fetchServers(token),
          fetchNetworks(token)
        ]);

        if (mounted) {
          setFloatingIPs(fipsData || []);
          setServers(serversData || []);

          const availableNetworks = (networksData || []).filter((network) => network.id);
          const externalNetworks = availableNetworks.filter(
            (network) => network['router:external'] || network.name?.toLowerCase().includes('public')
          );
          const candidateNetworks = externalNetworks.length ? externalNetworks : availableNetworks;

          setFloatingNetworks(candidateNetworks);

          const publicNetwork =
            candidateNetworks.find((network) => network.name?.toLowerCase() === 'public') ||
            candidateNetworks.find((network) => network.name?.toLowerCase().includes('public'));
          const resolvedDefaultNetworkId = publicNetwork?.id || candidateNetworks[0]?.id || '';

          setDefaultFloatingNetworkId(resolvedDefaultNetworkId);
          setNewFloatingIPNetwork(resolvedDefaultNetworkId);
        }
      } catch (e) {
        if (mounted) {
          showNotification('error', e.message || 'Không thể tải danh sách floating IP.');
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

  function showNotification(type, message) {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }

  function toggleFloatingIP(id, checked) {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) {
          return prev;
        }
        return [...prev, id];
      }
      return prev.filter((fipId) => fipId !== id);
    });
  }

  async function handleAddFloatingIP() {
    if (!newFloatingIPNetwork) {
      showNotification('error', 'Vui lòng chọn network.');
      return;
    }

    setProcessing(true);
    try {
      const created = await createFloatingIP(token, {
        floating_network_id: newFloatingIPNetwork
      });

      setFloatingIPs((prev) => [created, ...prev]);
      setNewFloatingIPNetwork(defaultFloatingNetworkId);
      setShowAddModal(false);
      showNotification('success', 'Tạo floating IP thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không tạo được floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteFloatingIPs() {
    if (!selectedIds.length) {
      showNotification('error', 'Vui lòng chọn floating IP cần xóa.');
      return;
    }

    setProcessing(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteFloatingIP(token, id)));
      
      const removed = new Set(selectedIds);
      setFloatingIPs((prev) => prev.filter((fip) => !removed.has(fip.id)));
      setSelectedIds([]);

      showNotification('success', 'Xóa floating IP thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không xóa được floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  function openAssociateModal(floatingIP) {
    setSelectedFloatingIP(floatingIP);
    setSelectedServerId('');
    setShowAssociateModal(true);
  }

  async function handleAssociateFloatingIP() {
    setProcessing(true);
    try {
      if (selectedFloatingIP?.port_id) {
        await updateFloatingIP(token, selectedFloatingIP.id, { port_id: null });
        showNotification('success', 'Gỡ floating IP thành công!');
      } else {
        if (!selectedServerId) {
          showNotification('error', 'Vui lòng chọn instance.');
          return;
        }

        const ports = await fetchPorts(token, { device_id: selectedServerId });
        const targetPortId = ports?.[0]?.id;

        if (!targetPortId) {
          showNotification('error', 'Không tìm thấy port của instance.');
          return;
        }

        await updateFloatingIP(token, selectedFloatingIP.id, { port_id: targetPortId });
        showNotification('success', 'Gắn floating IP thành công!');
      }

      const [fipsData, serversData] = await Promise.all([
        fetchFloatingIPs(token),
        fetchServers(token)
      ]);
      setFloatingIPs(fipsData || []);
      setServers(serversData || []);
      setShowAssociateModal(false);
      setSelectedFloatingIP(null);
    } catch (e) {
      showNotification('error', e.response?.data?.message || e.message || 'Không cập nhật được floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Đang tải...</p>;
  }

  return (
    <section className="floatingip-section">
      <h3>Quản lý Floating IP</h3>

      <div className="toolbar">
        <button
          type="button"
          className="btn primary"
          disabled={processing}
          onClick={() => {
            setNewFloatingIPNetwork(defaultFloatingNetworkId);
            setShowAddModal(true);
          }}
        >
          Tạo Floating IP
        </button>
        <button
          type="button"
          className="btn"
          disabled={processing || !selectedIds.length}
          onClick={handleDeleteFloatingIPs}
        >
          Xóa Floating IP đã chọn
        </button>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo Floating IP Mới</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                x
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="fip-network">Network</label>
                <select
                  id="fip-network"
                  value={newFloatingIPNetwork}
                  onChange={(e) => setNewFloatingIPNetwork(e.target.value)}
                >
                  <option value="">Chọn external network</option>
                  {floatingNetworks.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.name || network.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAddModal(false)}>
                Hủy
              </button>
              <button className="btn primary" disabled={processing} onClick={handleAddFloatingIP}>
                Tạo Floating IP
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssociateModal && selectedFloatingIP && (
        <div className="modal-overlay" onClick={() => setShowAssociateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gắn Floating IP</h3>
              <button className="modal-close" onClick={() => setShowAssociateModal(false)}>
                x
              </button>
            </div>

            <div className="modal-body">
              <p>Floating IP: <strong>{selectedFloatingIP.floating_ip_address}</strong></p>

              {!selectedFloatingIP.port_id && (
                <div className="form-group">
                  <label htmlFor="associate-server">Instance</label>
                  <select
                    id="associate-server"
                    value={selectedServerId}
                    onChange={(e) => setSelectedServerId(e.target.value)}
                  >
                    <option value="">Chọn instance</option>
                    {servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name} ({server.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAssociateModal(false)}>
                Hủy
              </button>
              <button className="btn primary" disabled={processing} onClick={handleAssociateFloatingIP}>
                {selectedFloatingIP.port_id ? 'Gỡ Floating IP' : 'Gắn Floating IP'}
              </button>
            </div>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Chọn</th>
            <th>Floating IP</th>
            <th>Port ID</th>
            <th>Status</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {floatingIPs.map((floatingIP) => (
            <tr key={floatingIP.id}>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(floatingIP.id)}
                  onChange={(e) => toggleFloatingIP(floatingIP.id, e.target.checked)}
                />
              </td>
              <td>{floatingIP.floating_ip_address}</td>
              <td>{floatingIP.port_id ? floatingIP.port_id.substring(0, 8) + '...' : '-'}</td>
              <td>{floatingIP.status || '-'}</td>
              <td>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => openAssociateModal(floatingIP)}
                  disabled={processing}
                >
                  {floatingIP.port_id ? 'Gỡ bỏ' : 'Gắn'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!floatingIPs.length && (
        <p className="empty-message">Không có floating IP nào. Vui lòng tạo mới.</p>
      )}

      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">
            <span className="notification-icon">{notification.type === 'success' ? 'v' : 'x'}</span>
            <p className="notification-message">{notification.message}</p>
          </div>
        </div>
      )}

      {processing && (
        <div className="processing-overlay">
          <div className="processing-popup">
            <div className="spinner"></div>
            <p>Đang xử lý...</p>
          </div>
        </div>
      )}
    </section>
  );
}
