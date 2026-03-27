import { useEffect, useState } from 'react';
import {
  createNetwork,
  createSubnet,
  deleteNetworks,
  fetchNetworks,
  updateNetworkName
} from '../api';

export default function NetworkPage({ token }) {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeNetworkId, setActiveNetworkId] = useState('');
  const [newNetworkName, setNewNetworkName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [subnetName, setSubnetName] = useState('');
  const [subnetCidr, setSubnetCidr] = useState('192.168.10.0/24');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
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
          if (data?.length && !activeNetworkId) {
            setActiveNetworkId(data[0].id);
            setRenameValue(data[0].name || '');
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'Không thể tải dữ liệu network.');
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

  const activeNetwork = items.find((item) => item.id === activeNetworkId);

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
  }

  async function handleAddNetwork() {
    if (!newNetworkName.trim()) {
      setError('Vui lòng nhập tên network mới.');
      return;
    }

    setError('');
    setProcessing(true);
    try {
      const created = await createNetwork(token, newNetworkName.trim());
      setItems((prev) => [created, ...prev]);
      setNewNetworkName('');
      setActiveNetworkId(created.id);
      setRenameValue(created.name || '');
    } catch (e) {
      setError(e.response?.data?.message || 'Không tạo được network.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedIds.length) {
      setError('Vui lòng chọn network cần xóa.');
      return;
    }

    setError('');
    setProcessing(true);
    try {
      await deleteNetworks(token, selectedIds);
      setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);

      if (selectedIds.includes(activeNetworkId)) {
        setActiveNetworkId('');
        setRenameValue('');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Không xóa được network.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleRenameNetwork() {
    if (!activeNetworkId) {
      setError('Vui lòng chọn network để sửa tên.');
      return;
    }

    if (!renameValue.trim()) {
      setError('Tên network không được để trống.');
      return;
    }

    setError('');
    setProcessing(true);
    try {
      const updated = await updateNetworkName(token, activeNetworkId, renameValue.trim());
      setItems((prev) =>
        prev.map((item) => (item.id === activeNetworkId ? { ...item, ...updated } : item))
      );
    } catch (e) {
      setError(e.response?.data?.message || 'Không sửa được tên network.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleAddSubnet() {
    if (!activeNetworkId) {
      setError('Vui lòng chọn network để thêm subnet.');
      return;
    }

    if (!subnetCidr.trim()) {
      setError('Vui lòng nhập CIDR cho subnet.');
      return;
    }

    setError('');
    setProcessing(true);
    try {
      const createdSubnet = await createSubnet(token, {
        name: subnetName.trim(),
        network_id: activeNetworkId,
        ip_version: 4,
        cidr: subnetCidr.trim(),
        enable_dhcp: true
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

      setSubnetName('');
    } catch (e) {
      setError(e.response?.data?.message || 'Không thêm được subnet.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Đang tải network...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  return (
    <section className="network-page">
      <h2>Network</h2>

      <div className="network-toolbar">
        <input
          type="text"
          placeholder="Tên network mới"
          value={newNetworkName}
          onChange={(e) => setNewNetworkName(e.target.value)}
        />
        <button type="button" className="btn primary" disabled={processing} onClick={handleAddNetwork}>
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
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
