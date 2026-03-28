import { useEffect, useMemo, useState } from 'react';
import {
  createServer,
  deleteServers,
  fetchFlavors,
  fetchImages,
  fetchServerDetail,
  fetchServers
} from '../api/computes';
import { fetchNetworks } from '../api/networks';

export default function ComputePage({ token, view }) {
  const [flavors, setFlavors] = useState([]);
  const [images, setImages] = useState([]);
  const [servers, setServers] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [selectedServerIds, setSelectedServerIds] = useState([]);
  const [activeServerId, setActiveServerId] = useState('');
  const [showAddInstanceModal, setShowAddInstanceModal] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [newFlavorId, setNewFlavorId] = useState('');
  const [newImageId, setNewImageId] = useState('');
  const [newNetworkId, setNewNetworkId] = useState('');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const activeServer = useMemo(
    () => servers.find((server) => server.id === activeServerId),
    [servers, activeServerId]
  );

  const activeFlavor = useMemo(() => {
    if (!activeServer?.flavor?.id) {
      return null;
    }

    return flavors.find((item) => item.id === activeServer.flavor.id) || null;
  }, [flavors, activeServer]);

  const activeImage = useMemo(() => {
    const imageId = activeServer?.image?.id;
    if (!imageId) {
      return null;
    }

    return images.find((item) => item.id === imageId) || null;
  }, [images, activeServer]);

  function showNotification(type, message) {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }

  async function loadInstances() {
    const [serversData, flavorsData, imagesData, networksData] = await Promise.all([
      fetchServers(token),
      fetchFlavors(token),
      fetchImages(token),
      fetchNetworks(token)
    ]);

    setServers(serversData || []);
    setFlavors(flavorsData || []);
    setImages(imagesData || []);
    setNetworks(networksData || []);

    if (serversData?.length && !activeServerId) {
      setActiveServerId(serversData[0].id);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        if (view === 'flavor') {
          const flavorsData = await fetchFlavors(token);
          if (mounted) {
            setFlavors(flavorsData || []);
          }
        } else if (view === 'instance') {
          if (mounted) {
            await loadInstances();
          }
        } else {
          const imagesData = await fetchImages(token);
          if (mounted) {
            setImages(imagesData || []);
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'Không thể tải dữ liệu compute.');
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
  }, [token, view]);

  useEffect(() => {
    let mounted = true;

    async function syncActiveServer() {
      if (view !== 'instance' || !activeServerId) {
        return;
      }

      try {
        const detail = await fetchServerDetail(token, activeServerId);
        if (!mounted || !detail) {
          return;
        }

        setServers((prev) =>
          prev.map((server) => (server.id === activeServerId ? { ...server, ...detail } : server))
        );
      } catch (e) {
        if (mounted) {
          showNotification('error', e.response?.data?.message || 'Không tải được chi tiết instance.');
        }
      }
    }

    syncActiveServer();

    return () => {
      mounted = false;
    };
  }, [token, view, activeServerId]);

  function toggleServer(serverId, checked) {
    setSelectedServerIds((prev) => {
      if (checked) {
        if (prev.includes(serverId)) {
          return prev;
        }
        return [...prev, serverId];
      }

      return prev.filter((id) => id !== serverId);
    });
  }

  async function handleAddInstance() {
    if (!newInstanceName.trim() || !newFlavorId || !newImageId || !newNetworkId) {
      showNotification('error', 'Vui lòng nhập đủ tên, flavor, image và network.');
      return;
    }

    setProcessing(true);
    try {
      await createServer(token, {
        name: newInstanceName.trim(),
        flavorRef: newFlavorId,
        imageRef: newImageId,
        networks: [{ uuid: newNetworkId }]
      });

      await loadInstances();
      setShowAddInstanceModal(false);
      setNewInstanceName('');
      setNewFlavorId('');
      setNewImageId('');
      setNewNetworkId('');
      showNotification('success', 'Tạo instance thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không tạo được instance.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteSelectedInstances() {
    if (!selectedServerIds.length) {
      showNotification('error', 'Vui lòng chọn instance cần xóa.');
      return;
    }

    setProcessing(true);
    try {
      await deleteServers(token, selectedServerIds);
      const removed = new Set(selectedServerIds);

      setServers((prev) => prev.filter((server) => !removed.has(server.id)));
      setSelectedServerIds([]);

      if (removed.has(activeServerId)) {
        setActiveServerId('');
      }

      showNotification('success', 'Xóa instance thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không xóa được instance.');
    } finally {
      setProcessing(false);
    }
  }

  function renderAddresses(addresses) {
    const entries = Object.entries(addresses || {});
    if (!entries.length) {
      return ['-'];
    }

    return entries.map(([networkName, values]) => {
      const ips = (values || [])
        .map((item) => item.addr)
        .filter(Boolean)
        .join(', ');

      return `${networkName}: ${ips || '-'}`;
    });
  }

  if (loading) {
    return <p>Đang tải...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (view === 'instance') {
    return (
      <section className="network-page">
        <h2>Compute</h2>

        <div className="network-toolbar">
          <button
            type="button"
            className="btn primary"
            disabled={processing}
            onClick={() => setShowAddInstanceModal(true)}
          >
            Thêm instance
          </button>
          <button
            type="button"
            className="btn"
            disabled={processing || !selectedServerIds.length}
            onClick={handleDeleteSelectedInstances}
          >
            Xóa instance đã chọn
          </button>
        </div>

        {showAddInstanceModal && (
          <div className="modal-overlay" onClick={() => setShowAddInstanceModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Thêm Instance Mới</h3>
                <button className="modal-close" onClick={() => setShowAddInstanceModal(false)}>
                  x
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="instance-name">Tên instance</label>
                  <input
                    id="instance-name"
                    type="text"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    placeholder="Nhập tên máy"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="instance-flavor">Flavor</label>
                  <select
                    id="instance-flavor"
                    value={newFlavorId}
                    onChange={(e) => setNewFlavorId(e.target.value)}
                  >
                    <option value="">Chọn flavor</option>
                    {flavors.map((flavor) => (
                      <option key={flavor.id} value={flavor.id}>
                        {flavor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="instance-image">Image</label>
                  <select
                    id="instance-image"
                    value={newImageId}
                    onChange={(e) => setNewImageId(e.target.value)}
                  >
                    <option value="">Chọn image</option>
                    {images.map((image) => (
                      <option key={image.id} value={image.id}>
                        {image.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="instance-network">Network</label>
                  <select
                    id="instance-network"
                    value={newNetworkId}
                    onChange={(e) => setNewNetworkId(e.target.value)}
                  >
                    <option value="">Chọn network</option>
                    {networks.map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.name || network.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn" onClick={() => setShowAddInstanceModal(false)}>
                  Hủy
                </button>
                <button className="btn primary" disabled={processing} onClick={handleAddInstance}>
                  Tạo instance
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
                  <th>Tên</th>
                  <th>Trạng thái</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server) => (
                  <tr
                    key={server.id}
                    className={server.id === activeServerId ? 'row-active' : ''}
                    onClick={() => setActiveServerId(server.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedServerIds.includes(server.id)}
                        onChange={(e) => toggleServer(server.id, e.target.checked)}
                      />
                    </td>
                    <td>{server.name || '-'}</td>
                    <td>{server.status || '-'}</td>
                    <td>{server.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="network-detail">
            {!activeServer && <p>Chọn một instance để xem mô tả chi tiết máy.</p>}

            {activeServer && (
              <div className="detail-info">
                <h3>Mô tả chi tiết máy</h3>
                <p>
                  <strong>Tên:</strong> {activeServer.name || '-'}
                </p>
                <p>
                  <strong>ID:</strong> {activeServer.id}
                </p>
                <p>
                  <strong>Trạng thái:</strong> {activeServer.status || '-'}
                </p>
                <p>
                  <strong>VM State:</strong> {activeServer['OS-EXT-STS:vm_state'] || '-'}
                </p>
                <p>
                  <strong>Power State:</strong> {activeServer['OS-EXT-STS:power_state'] ?? '-'}
                </p>
                <p>
                  <strong>Task State:</strong> {activeServer['OS-EXT-STS:task_state'] || '-'}
                </p>
                <p>
                  <strong>Flavor:</strong> {activeFlavor?.name || activeServer?.flavor?.id || '-'}
                </p>
                <p>
                  <strong>vCPU:</strong> {activeFlavor?.vcpus ?? '-'}
                </p>
                <p>
                  <strong>RAM (MB):</strong> {activeFlavor?.ram ?? '-'}
                </p>
                <p>
                  <strong>Disk (GB):</strong> {activeFlavor?.disk ?? '-'}
                </p>
                <p>
                  <strong>Image:</strong> {activeImage?.name || activeServer?.image?.id || '-'}
                </p>
                <p>
                  <strong>Key Pair:</strong> {activeServer.key_name || '-'}
                </p>
                <p>
                  <strong>Zone:</strong> {activeServer['OS-EXT-AZ:availability_zone'] || '-'}
                </p>
                <p>
                  <strong>Created:</strong> {activeServer.created || '-'}
                </p>
                <p>
                  <strong>Updated:</strong> {activeServer.updated || '-'}
                </p>
                <p>
                  <strong>IP theo mạng:</strong>
                </p>
                <ul>
                  {renderAddresses(activeServer.addresses).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

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

  return (
    <section>
      <h2>Compute</h2>

      {view === 'flavor' && (
        <>
          <h3>Flavors</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {flavors.map((flavor) => (
                <tr key={flavor.id}>
                  <td>{flavor.id}</td>
                  <td>{flavor.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {view === 'image' && (
        <>
          <h3>Images</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {images.map((image) => (
                <tr key={image.id}>
                  <td>{image.id}</td>
                  <td>{image.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
