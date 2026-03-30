import { useEffect, useMemo, useState } from 'react';
import {
  createServer,
  deleteServers,
  fetchFlavors,
  fetchImages,
  fetchKeypairs,
  fetchServerDetail,
  fetchServers,
  startServer
} from '../api/computes';
import {
  fetchFloatingIPs,
  fetchNetworks,
  fetchPorts,
  fetchSecurityGroups,
  updateFloatingIP
} from '../api/networks';

export default function ComputePage({ token, view }) {
  const [flavors, setFlavors] = useState([]);
  const [images, setImages] = useState([]);
  const [servers, setServers] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [keypairs, setKeypairs] = useState([]);
  const [securityGroups, setSecurityGroups] = useState([]);
  const [floatingIPs, setFloatingIPs] = useState([]);

  const [selectedServerIds, setSelectedServerIds] = useState([]);
  const [activeServerId, setActiveServerId] = useState('');

  const [showAddInstanceModal, setShowAddInstanceModal] = useState(false);
  const [showAssociateFloatingIpModal, setShowAssociateFloatingIpModal] = useState(false);

  const [newInstanceName, setNewInstanceName] = useState('');
  const [newFlavorId, setNewFlavorId] = useState('');
  const [newImageId, setNewImageId] = useState('');
  const [newNetworkId, setNewNetworkId] = useState('');
  const [newKeyPairName, setNewKeyPairName] = useState('');
  const [newSecurityGroupName, setNewSecurityGroupName] = useState('');

  const [selectedFloatingIpId, setSelectedFloatingIpId] = useState('');

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

  const availableFloatingIPs = useMemo(
    () => floatingIPs.filter((fip) => !fip.port_id),
    [floatingIPs]
  );

  const normalizedKeypairs = useMemo(
    () => (keypairs || []).map((item) => item?.keypair || item).filter((item) => item?.name),
    [keypairs]
  );

  const selectedFlavor = useMemo(
    () => flavors.find((flavor) => flavor.id === newFlavorId) || null,
    [flavors, newFlavorId]
  );

  const selectedImage = useMemo(
    () => images.find((image) => image.id === newImageId) || null,
    [images, newImageId]
  );

  const selectedKeypair = useMemo(
    () => normalizedKeypairs.find((item) => item.name === newKeyPairName) || null,
    [normalizedKeypairs, newKeyPairName]
  );

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function encodeBase64Utf8(content) {
    return window.btoa(unescape(encodeURIComponent(content)));
  }

  function buildCloudInit(instanceName, publicKey = null) {
    const safeInstanceName = escapeHtml(instanceName || 'unknown-instance');
    const htmlContent = `<!doctype html>
<html>
  <head>
    <meta charset='utf-8' />
    <title>NT533 VM</title>
  </head>
  <body>
    <h1>NT533.Q21.G8</h1>
    <p>Instance: ${safeInstanceName}</p>
    <p>IP: __IP_ADDR__</p>
  </body>
</html>`;
    const htmlContentB64 = encodeBase64Utf8(htmlContent);
    const normalizedPublicKey = publicKey?.replace(/\r?\n/g, '').trim();

    let script = `#cloud-config

# Set DNS FIRST (bootcmd) before package_update
bootcmd:
  - |
    echo "nameserver 8.8.8.8" > /etc/resolv.conf.new
    echo "nameserver 1.1.1.1" >> /etc/resolv.conf.new
    if [ -f /etc/resolv.conf ]; then
      grep -v "^nameserver" /etc/resolv.conf >> /etc/resolv.conf.new 2>/dev/null || true
    fi
    mv /etc/resolv.conf.new /etc/resolv.conf

# Update packages
package_update: true
package_upgrade: true
write_files:
  - path: /var/www/html/index.html
    owner: root:root
    permissions: '0644'
    encoding: b64
    content: ${htmlContentB64}
`;

    // Add SSH authorized keys if provided
    if (normalizedPublicKey) {
      script += `ssh_authorized_keys:
  - ${normalizedPublicKey}
`;
    }

    script += `runcmd:
  # Install nginx (multi-distro)
  - |
    if command -v apt-get >/dev/null 2>&1; then
      apt-get install -y nginx
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y nginx
    elif command -v yum >/dev/null 2>&1; then
      yum install -y nginx
    fi

  # Enable and restart SSH
  - |
    if systemctl list-unit-files | grep -q "^ssh.service"; then
      systemctl enable ssh
      systemctl restart ssh
    elif systemctl list-unit-files | grep -q "^sshd.service"; then
      systemctl enable sshd
      systemctl restart sshd
    fi

  # Enable and restart nginx
  - systemctl enable nginx || true
  - systemctl restart nginx || true

  # Create web page
  - |
    IP_ADDR=\$(hostname -I | awk '{print $1}')
    sed -i "s|__IP_ADDR__|\$IP_ADDR|g" /var/www/html/index.html
`;

    return script;
  }

  function showNotification(type, message) {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }

  function getApiErrorMessage(error, fallbackMessage) {
    return (
      error?.response?.data?.forbidden?.message ||
      error?.response?.data?.badRequest?.message ||
      error?.response?.data?.conflictingRequest?.message ||
      error?.response?.data?.message ||
      error?.message ||
      fallbackMessage
    );
  }

  async function loadInstances() {
    const [
      serversData,
      flavorsData,
      imagesData,
      networksData,
      keypairsData,
      securityGroupsData,
      floatingIPsData
    ] = await Promise.all([
      fetchServers(token),
      fetchFlavors(token),
      fetchImages(token),
      fetchNetworks(token),
      fetchKeypairs(token),
      fetchSecurityGroups(token),
      fetchFloatingIPs(token)
    ]);

    setServers(serversData || []);
    setFlavors(flavorsData || []);
    setImages(imagesData || []);
    setNetworks(networksData || []);
    setKeypairs(keypairsData || []);
    setSecurityGroups(securityGroupsData || []);
    setFloatingIPs(floatingIPsData || []);

    const firstKeypairName =
      (keypairsData || []).map((item) => item?.keypair || item).find((item) => item?.name)?.name || '';
    if (!newKeyPairName && firstKeypairName) {
      setNewKeyPairName(firstKeypairName);
    }

    if (!newSecurityGroupName) {
      const defaultGroup = (securityGroupsData || []).find((group) => group.name === 'default');
      setNewSecurityGroupName(defaultGroup?.name || securityGroupsData?.[0]?.name || '');
    }

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
          setError(e.response?.data?.message || e.message || 'Không thể tải dữ liệu compute.');
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
      const flavorDisk = Number(selectedFlavor?.disk ?? 0);
      const imageMinDisk = Number(selectedImage?.min_disk ?? selectedImage?.minDisk ?? 0);
      const volumeSize = Math.max(1, imageMinDisk || 10);

      const payload = {
        name: newInstanceName.trim(),
        flavorRef: newFlavorId,
        networks: [{ uuid: newNetworkId }],
        key_name: newKeyPairName || undefined,
        security_groups: newSecurityGroupName ? [{ name: newSecurityGroupName }] : undefined
      };

      payload.user_data = encodeBase64Utf8(
        buildCloudInit(newInstanceName.trim(), selectedKeypair?.public_key || null)
      );

      if (flavorDisk === 0) {
        payload.block_device_mapping_v2 = [
          {
            uuid: newImageId,
            source_type: 'image',
            destination_type: 'volume',
            boot_index: 0,
            delete_on_termination: true,
            volume_size: volumeSize
          }
        ];
      } else {
        payload.imageRef = newImageId;
      }

      await createServer(token, payload);

      await loadInstances();
      setShowAddInstanceModal(false);
      setNewInstanceName('');
      setNewFlavorId('');
      setNewImageId('');
      setNewNetworkId('');
      setNewKeyPairName('');
      showNotification('success', 'Tạo instance thành công! Có thể gắn Floating IP ở nút riêng.');
    } catch (e) {
      showNotification('error', getApiErrorMessage(e, 'Không tạo được instance.'));
    } finally {
      setProcessing(false);
    }
  }

  async function handleStartInstance() {
    if (!activeServerId) {
      showNotification('error', 'Vui lòng chọn instance cần khởi động.');
      return;
    }

    const activeServer = servers.find((s) => s.id === activeServerId);
    if (activeServer?.status !== 'SHUTOFF') {
      showNotification('error', 'Chỉ có thể khởi động máy ở trạng thái SHUTOFF.');
      return;
    }

    setProcessing(true);
    try {
      const response = await startServer(token, activeServerId);
      await loadInstances();
      if (response) {
        showNotification('success', 'Khởi động instance thành công!');
      } else {
        showNotification('error', 'Không khởi động được instance.');
      }
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không khởi động được instance.');
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

  async function handleAssociateFloatingIpToActiveServer() {
    if (!activeServerId) {
      showNotification('error', 'Vui lòng chọn instance.');
      return;
    }

    if (!selectedFloatingIpId) {
      showNotification('error', 'Vui lòng chọn floating IP.');
      return;
    }

    setProcessing(true);
    try {
      const ports = await fetchPorts(token, { device_id: activeServerId });
      const targetPortId = ports?.[0]?.id;

      if (!targetPortId) {
        showNotification('error', 'Không tìm thấy port của instance để gắn floating IP.');
        return;
      }

      await updateFloatingIP(token, selectedFloatingIpId, { port_id: targetPortId });
      await loadInstances();
      setShowAssociateFloatingIpModal(false);
      setSelectedFloatingIpId('');
      showNotification('success', 'Gắn floating IP thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không gắn được floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleDisassociateFloatingIp(floatingIpId) {
    setProcessing(true);
    try {
      await updateFloatingIP(token, floatingIpId, { port_id: null });
      await loadInstances();
      showNotification('success', 'Gỡ floating IP thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không gỡ được floating IP.');
    } finally {
      setProcessing(false);
    }
  }

  function getActiveServerFloatingIps() {
    if (!activeServerId) {
      return [];
    }

    return floatingIPs.filter((floatingIp) => {
      const attachedServerId =
        floatingIp?.['port_details']?.device_id || floatingIp?.['port_details']?.device_owner;

      if (attachedServerId && attachedServerId === activeServerId) {
        return true;
      }

      const addresses = Object.values(activeServer?.addresses || {}).flat();
      const hasFixedIp = addresses.some((item) => item.addr && item.addr === floatingIp.fixed_ip_address);
      return hasFixedIp;
    });
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
    const activeServerFloatingIps = getActiveServerFloatingIps();

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
          <button
            type="button"
            className="btn"
            disabled={processing || !activeServer || !availableFloatingIPs.length}
            onClick={() => setShowAssociateFloatingIpModal(true)}
          >
            Gắn Floating IP cho máy đang chọn
          </button>
          <button
            type="button"
            className="btn"
            disabled={processing || !activeServer || activeServer?.status !== 'SHUTOFF'}
            onClick={handleStartInstance}
          >
            Khởi động máy
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

                <div className="form-group">
                  <label htmlFor="instance-keypair">Keypair (tùy chọn)</label>
                  <select
                    id="instance-keypair"
                    value={newKeyPairName}
                    onChange={(e) => setNewKeyPairName(e.target.value)}
                  >
                    <option value="">Không dùng keypair</option>
                    {normalizedKeypairs.map((keypair) => (
                      <option key={keypair.name} value={keypair.name}>
                        {keypair.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="instance-security-group">Security Group</label>
                  <select
                    id="instance-security-group"
                    value={newSecurityGroupName}
                    onChange={(e) => setNewSecurityGroupName(e.target.value)}
                  >
                    {(securityGroups || []).map((group) => (
                      <option key={group.id} value={group.name}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <small>Khuyến nghị dùng default.</small>
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

        {showAssociateFloatingIpModal && (
          <div className="modal-overlay" onClick={() => setShowAssociateFloatingIpModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Gắn Floating IP cho {activeServer?.name || activeServer?.id || 'instance'}</h3>
                <button className="modal-close" onClick={() => setShowAssociateFloatingIpModal(false)}>
                  x
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="associate-floating-ip">Floating IP chưa gắn</label>
                  <select
                    id="associate-floating-ip"
                    value={selectedFloatingIpId}
                    onChange={(e) => setSelectedFloatingIpId(e.target.value)}
                  >
                    <option value="">Chọn floating IP</option>
                    {availableFloatingIPs.map((fip) => (
                      <option key={fip.id} value={fip.id}>
                        {fip.floating_ip_address}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn" onClick={() => setShowAssociateFloatingIpModal(false)}>
                  Hủy
                </button>
                <button
                  className="btn primary"
                  disabled={processing || !selectedFloatingIpId}
                  onClick={handleAssociateFloatingIpToActiveServer}
                >
                  Gắn
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

                <p>
                  <strong>Floating IP đang gắn:</strong>
                </p>
                {activeServerFloatingIps.length === 0 && <p>-</p>}
                {activeServerFloatingIps.length > 0 && (
                  <ul>
                    {activeServerFloatingIps.map((fip) => (
                      <li key={fip.id}>
                        {fip.floating_ip_address}
                        <button
                          type="button"
                          className="btn small"
                          style={{ marginLeft: '8px' }}
                          disabled={processing}
                          onClick={() => handleDisassociateFloatingIp(fip.id)}
                        >
                          Gỡ
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div style={{ marginTop: '16px' }}>
                  {activeServer.status === 'SHUTOFF' && (
                    <button
                      type="button"
                      className="btn primary"
                      disabled={processing}
                      onClick={handleStartInstance}
                      style={{ marginRight: '8px' }}
                    >
                      Khởi động máy
                    </button>
                  )}
                  {activeServer.status !== 'SHUTOFF' && (
                    <p style={{ color: '#666', fontSize: '0.9em' }}>
                      Máy hiện ở trạng thái <strong>{activeServer.status}</strong>. Chỉ có thể khởi động khi ở trạng thái SHUTOFF.
                    </p>
                  )}
                </div>
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