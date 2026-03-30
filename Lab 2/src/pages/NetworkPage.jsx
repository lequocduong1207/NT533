import { useEffect, useState } from 'react';
import {
  createNetwork,
  createSubnet,
  deleteSubnet,
  deleteNetworks,
  fetchNetworks,
  fetchSubnets,
  updateSubnet,
  updateNetworkName
} from '../api/networks';

export default function NetworkPage({ token }) {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeNetworkId, setActiveNetworkId] = useState('');
  const [newNetworkName, setNewNetworkName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [subnetName, setSubnetName] = useState('');
  const [subnetCidr, setSubnetCidr] = useState('192.168.10.0/24');
  const [subnetItems, setSubnetItems] = useState([]);
  const [editingSubnetId, setEditingSubnetId] = useState('');
  const [editSubnetName, setEditSubnetName] = useState('');
  const [editSubnetCidr, setEditSubnetCidr] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddNetworkModal, setShowAddNetworkModal] = useState(false);
  const [modalSubnetName, setModalSubnetName] = useState('');
  const [modalSubnetCidr, setModalSubnetCidr] = useState('192.168.10.0/24');
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchNetworks(token);
        if (mounted) {
          setItems(data || []);
          if (data?.length && !activeNetworkId) {
            setActiveNetworkId(data[0].id);
            setRenameValue(data[0].name || '');
          }
        }
      } catch (e) {
        if (mounted) {
          showNotification('error', e.message || 'Không thể tải dữ liệu network.');
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

  useEffect(() => {
    let mounted = true;

    async function loadSubnets() {
      if (!activeNetworkId) {
        setSubnetItems([]);
        return;
      }

      try {
        const data = await fetchSubnets(token, activeNetworkId);
        if (mounted) {
          setSubnetItems(data || []);
        }
      } catch (e) {
        if (mounted) {
          showNotification('error', e.response?.data?.message || 'Không tải được danh sách subnet.');
        }
      }
    }

    loadSubnets();

    return () => {
      mounted = false;
    };
  }, [token, activeNetworkId]);

  const activeNetwork = items.find((item) => item.id === activeNetworkId);

  // Helper function to show notifications with auto-dismiss
  function showNotification(type, message) {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3000); // Auto dismiss after 3 seconds
  }

  function toggleNetwork(id, checked) {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) {
          return prev;
        }
        return [...prev, id];
      }

      return prev.filter((itemId) => itemId !== id);
    });
  }

  function selectActive(network) {
    setActiveNetworkId(network.id);
    setRenameValue(network.name || '');
    setEditingSubnetId('');
    setEditSubnetName('');
    setEditSubnetCidr('');
  }

  function startEditSubnet(subnet) {
    setEditingSubnetId(subnet.id);
    setEditSubnetName(subnet.name || '');
    setEditSubnetCidr(subnet.cidr || '');
  }

  function cancelEditSubnet() {
    setEditingSubnetId('');
    setEditSubnetName('');
    setEditSubnetCidr('');
  }

  async function handleAddNetwork() {
    if (!newNetworkName.trim()) {
      showNotification('error', 'Vui lòng nhập tên network mới.');
      return;
    }

    setProcessing(true);
    try {
      const created = await createNetwork(token, newNetworkName.trim());
      setItems((prev) => [created, ...prev]);
      
      // Add subnet if CIDR is provided
      if (modalSubnetCidr.trim()) {
        try {
          const createdSubnet = await createSubnet(token, {
            name: modalSubnetName.trim() || 'subnet-' + created.id.substring(0, 8),
            network_id: created.id,
            ip_version: 4,
            cidr: modalSubnetCidr.trim(),
            enable_dhcp: true
          });

          setItems((prev) =>
            prev.map((item) =>
              item.id === created.id
                ? { ...item, subnets: [...(item.subnets || []), createdSubnet.id] }
                : item
            )
          );
        } catch (subnetError) {
          console.warn('Thêm subnet không thành công, nhưng network đã được tạo:', subnetError);
        }
      }

      // Reset form
      setNewNetworkName('');
      setModalSubnetName('');
      setModalSubnetCidr('192.168.10.0/24');
      setShowAddNetworkModal(false);
      setActiveNetworkId(created.id);
      setRenameValue(created.name || '');
      showNotification('success', 'Tạo network thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không tạo được network.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedIds.length) {
      showNotification('error', 'Vui lòng chọn network cần xóa.');
      return;
    }

    setProcessing(true);
    try {
      await deleteNetworks(token, selectedIds);
      setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);

      if (selectedIds.includes(activeNetworkId)) {
        setActiveNetworkId('');
        setRenameValue('');
      }
      showNotification('success', 'Xóa network thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không xóa được network.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRenameNetwork() {
    if (!activeNetworkId) {
      showNotification('error', 'Vui lòng chọn network để sửa tên.');
      return;
    }

    if (!renameValue.trim()) {
      showNotification('error', 'Tên network không được để trống.');
      return;
    }

    setProcessing(true);
    try {
      const updated = await updateNetworkName(token, activeNetworkId, renameValue.trim());
      setItems((prev) =>
        prev.map((item) => (item.id === activeNetworkId ? { ...item, ...updated } : item))
      );
      showNotification('success', 'Sửa tên network thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không sửa được tên network.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleAddSubnet() {
    if (!activeNetworkId) {
      showNotification('error', 'Vui lòng chọn network để thêm subnet.');
      return;
    }

    if (!subnetCidr.trim()) {
      showNotification('error', 'Vui lòng nhập CIDR cho subnet.');
      return;
    }

    setProcessing(true);
    try {
      const createdSubnet = await createSubnet(token, {
        name: subnetName.trim(),
        network_id: activeNetworkId,
        ip_version: 4,
        cidr: subnetCidr.trim(),
      });

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== activeNetworkId) {
            return item;
          }

          return {
            ...item,
            subnets: [...(item.subnets || []), createdSubnet.id]
          };
        })
      );

      setSubnetItems((prev) => [createdSubnet, ...prev]);
      setSubnetName('');
      showNotification('success', 'Thêm subnet thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không thêm được subnet.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleSaveSubnet(subnetId) {
    setProcessing(true);
    try {
      const updated = await updateSubnet(token, subnetId, {
        name: editSubnetName.trim(),
      });
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không sửa được tên subnet.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Đang tải network...</p>;
  }

  async function handleDeleteSubnet(subnetId) {
    setProcessing(true);
    try {
      await deleteSubnet(token, subnetId);
      setSubnetItems((prev) => prev.filter((item) => item.id !== subnetId));
      setItems((prev) =>
        prev.map((network) => {
          if (network.id !== activeNetworkId) {
            return network;
          }

          return {
            ...network,
            subnets: (network.subnets || []).filter((id) => id !== subnetId)
          };
        })
      );
      showNotification('success', 'Xóa subnet thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không xóa được subnet.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Đang tải network...</p>;
  }

  return (
    <section className="network-page">
      <h2>Network</h2>

      <div className="network-toolbar">
        <button 
          type="button" 
          className="btn primary" 
          disabled={processing} 
          onClick={() => setShowAddNetworkModal(true)}
        >
          Thêm network
        </button>
        <button
          type="button"
          className="btn"
          disabled={processing || !selectedIds.length}
          onClick={handleDeleteSelected}
        >
          Xóa network đã chọn
        </button>
      </div>

      {/* Modal thêm network */}
      {showAddNetworkModal && (
        <div className="modal-overlay" onClick={() => setShowAddNetworkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm Network Mới</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowAddNetworkModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="modal-network-name">Tên Network</label>
                <input
                  id="modal-network-name"
                  type="text"
                  placeholder="Nhập tên network"
                  value={newNetworkName}
                  onChange={(e) => setNewNetworkName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-subnet-name">Tên Subnet (tùy chọn)</label>
                <input
                  id="modal-subnet-name"
                  type="text"
                  placeholder="Để trống để tự động đặt tên"
                  value={modalSubnetName}
                  onChange={(e) => setModalSubnetName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="modal-subnet-cidr">CIDR Subnet (tùy chọn)</label>
                <input
                  id="modal-subnet-cidr"
                  type="text"
                  placeholder="vd: 192.168.1.0/24"
                  value={modalSubnetCidr}
                  onChange={(e) => setModalSubnetCidr(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn" 
                onClick={() => setShowAddNetworkModal(false)}
              >
                Hủy
              </button>
              <button 
                className="btn primary" 
                disabled={processing || !newNetworkName.trim()}
                onClick={handleAddNetwork}
              >
                {processing ? 'Đang xử lý...' : 'Tạo Network'}
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
                <th>Chon</th>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((network) => (
                <tr
                  key={network.id}
                  className={network.id === activeNetworkId ? 'row-active' : ''}
                  onClick={() => selectActive(network)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(network.id)}
                      onChange={(e) => toggleNetwork(network.id, e.target.checked)}
                    />
                  </td>
                  <td>{network.id}</td>
                  <td>{network.name || '-'}</td>
                  <td>{network.status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="network-detail">
          {!activeNetwork && <p>Chọn một network để xem thông tin chi tiết.</p>}

          {activeNetwork && (
            <>
              <div className="detail-actions">
                <h3>Quản lý network</h3>

                <label htmlFor="rename-network">Sửa tên network</label>
                <div className="inline-form">
                  <input
                    id="rename-network"
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={processing}
                    onClick={handleRenameNetwork}
                  >
                    Lưu tên
                  </button>
                </div>

                <label htmlFor="subnet-name">Thêm subnet</label>
                <div className="inline-form subnet-form">
                  <input
                    id="subnet-name"
                    type="text"
                    placeholder="Tên subnet"
                    value={subnetName}
                    onChange={(e) => setSubnetName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="CIDR (vd: 192.168.1.0/24)"
                    value={subnetCidr}
                    onChange={(e) => setSubnetCidr(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={processing}
                    onClick={handleAddSubnet}
                  >
                    Thêm subnet
                  </button>
                </div>
              </div>

              <div className="detail-info">
                <h3>Thông tin chi tiết mạng</h3>
                <p>
                  <strong>ID:</strong> {activeNetwork.id}
                </p>
                <p>
                  <strong>Name:</strong> {activeNetwork.name || '-'}
                </p>
                <p>
                  <strong>Status:</strong> {activeNetwork.status || '-'}
                </p>
                <p>
                  <strong>Project ID:</strong> {activeNetwork.project_id || '-'}
                </p>
                <p>
                  <strong>Subnets:</strong> {(activeNetwork.subnets || []).join(', ') || '-'}
                </p>

                <h3>Danh sách subnet</h3>
                {!subnetItems.length && <p>Network này chưa có subnet.</p>}

                {!!subnetItems.length && (
                  <table>
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>CIDR</th>
                        <th>ID</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subnetItems.map((subnet) => {
                        const isEditing = editingSubnetId === subnet.id;

                        return (
                          <tr key={subnet.id}>
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editSubnetName}
                                  onChange={(e) => setEditSubnetName(e.target.value)}
                                />
                              ) : (
                                subnet.name || '-'
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editSubnetCidr}
                                  onChange={(e) => setEditSubnetCidr(e.target.value)}
                                />
                              ) : (
                                subnet.cidr || '-'
                              )}
                            </td>
                            <td>{subnet.id}</td>
                            <td>
                              <div className="inline-form subnet-actions">
                                {!isEditing && (
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={processing}
                                    onClick={() => startEditSubnet(subnet)}
                                  >
                                    Sửa
                                  </button>
                                )}

                                {isEditing && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn"
                                      disabled={processing}
                                      onClick={() => handleSaveSubnet(subnet.id)}
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      type="button"
                                      className="btn"
                                      disabled={processing}
                                      onClick={cancelEditSubnet}
                                    >
                                      Hủy
                                    </button>
                                  </>
                                )}

                                <button
                                  type="button"
                                  className="btn"
                                  disabled={processing}
                                  onClick={() => handleDeleteSubnet(subnet.id)}
                                >
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </section>
  );
}