import { useEffect, useState } from 'react';
import {
  createKeypair,
  deleteKeypair,
  fetchKeypairs
} from '../api/computes';

export default function KeypairManager({ token }) {
  const [keypairs, setKeypairs] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [newKeypairName, setNewKeypairName] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState(null);

  // Load keypairs
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchKeypairs(token);
        if (mounted) {
          setKeypairs(data || []);
        }
      } catch (e) {
        if (mounted) {
          showNotification('error', e.message || 'Không thể tải danh sách keypair.');
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

  function toggleKeypair(name, checked) {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(name)) {
          return prev;
        }
        return [...prev, name];
      }
      return prev.filter((id) => id !== name);
    });
  }

  function downloadPrivateKeyFile(privateKey, keypairName) {
    const normalizedName = (keypairName || 'keypair').trim() || 'keypair';
    const blob = new Blob([privateKey], { type: 'application/x-pem-file' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${normalizedName}.pem`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  function extractKeypairData(item) {
    return item?.keypair || item;
  }

  async function handleAddKeypair() {
    const keypairName = newKeypairName.trim();

    if (!keypairName) {
      showNotification('error', 'Vui lòng nhập tên keypair.');
      return;
    }

    setProcessing(true);
    try {
      const created = await createKeypair(token, keypairName);
      const createdKeypair = extractKeypairData(created);

      setKeypairs((prev) => [{ keypair: createdKeypair }, ...prev]);
      setNewKeypairName('');
      setShowAddModal(false);

      if (createdKeypair?.private_key) {
        downloadPrivateKeyFile(createdKeypair.private_key, createdKeypair.name || keypairName);
        showNotification('success', 'Tạo keypair thành công! Đã tải file .pem.');
      } else {
        showNotification('success', 'Tạo keypair thành công! Nhưng không có private key để tải file .pem.');
      }
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không tạo được keypair.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteKeypairs() {
    if (!selectedIds.length) {
      showNotification('error', 'Vui lòng chọn keypair cần xóa.');
      return;
    }

    setProcessing(true);
    try {
      await Promise.all(selectedIds.map((name) => deleteKeypair(token, name)));
      
      const removed = new Set(selectedIds);
      setKeypairs((prev) => prev.filter((kp) => !removed.has(kp.name)));
      setSelectedIds([]);

      showNotification('success', 'Xóa keypair thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không xóa được keypair.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Đang tải...</p>;
  }

  return (
    <section className="keypair-section">
      <h3>Quản lý Keypair</h3>

      <div className="toolbar">
        <button
          type="button"
          className="btn primary"
          disabled={processing}
          onClick={() => setShowAddModal(true)}
        >
          Thêm Keypair
        </button>
        <button
          type="button"
          className="btn"
          disabled={processing || !selectedIds.length}
          onClick={handleDeleteKeypairs}
        >
          Xóa Keypair đã chọn
        </button>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm Keypair Mới</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                x
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="keypair-name">Tên Keypair</label>
                <input
                  id="keypair-name"
                  type="text"
                  value={newKeypairName}
                  onChange={(e) => setNewKeypairName(e.target.value)}
                  placeholder="Nhập tên keypair"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAddModal(false)}>
                Hủy
              </button>
              <button className="btn primary" disabled={processing} onClick={handleAddKeypair}>
                Tạo Keypair
              </button>
            </div>
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Chọn</th>
            <th>Tên</th>
            <th>Fingerprint</th>
          </tr>
        </thead>
        <tbody>
          {keypairs.map((keypair) => (
            <tr key={extractKeypairData(keypair)?.name}>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(extractKeypairData(keypair)?.name)}
                  onChange={(e) => toggleKeypair(extractKeypairData(keypair)?.name, e.target.checked)}
                />
              </td>
              <td>{extractKeypairData(keypair)?.name}</td>
              <td>{extractKeypairData(keypair)?.fingerprint || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!keypairs.length && (
        <p className="empty-message">Không có keypair nào. Vui lòng tạo mới.</p>
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
