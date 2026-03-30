import { useEffect, useMemo, useState } from 'react';
import { fetchServers } from '../api/computes';
import {
  createLoadBalancer,
  deleteLoadBalancer,
  fetchLoadBalancerDetail,
  fetchLoadBalancers,
} from '../api/loadBlancer';
import {
  fetchFloatingIPs,
  fetchNetworks,
  fetchPorts,
  fetchSubnets,
  updateFloatingIP
} from '../api/networks';

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

export default function LoadBalancerManager({ token }) {
  const [loadBalancers, setLoadBalancers] = useState([]);
  const [selectedLoadBalancerIds, setSelectedLoadBalancerIds] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [subnets, setSubnets] = useState([]);
  const [servers, setServers] = useState([]);
  const [floatingIPs, setFloatingIPs] = useState([]);

  const [lbName, setLbName] = useState('lb-web');
  const [lbDescription, setLbDescription] = useState('Load balancer cho web tier');
  const [lbSubnetId, setLbSubnetId] = useState('');
  const [lbProvider, setLbProvider] = useState('');
  const [lbAdminStateUp, setLbAdminStateUp] = useState(true);

  const [listenerName, setListenerName] = useState('listener-http');
  const [listenerProtocol, setListenerProtocol] = useState('HTTP');
  const [listenerPort, setListenerPort] = useState(80);

  const [poolName, setPoolName] = useState('pool-web');
  const [poolProtocol, setPoolProtocol] = useState('HTTP');
  const [poolAlgorithm, setPoolAlgorithm] = useState('ROUND_ROBIN');

  const [selectedServerIds, setSelectedServerIds] = useState([]);
  const [memberPorts, setMemberPorts] = useState({});

  const [monitorType, setMonitorType] = useState('HTTP');
  const [monitorDelay, setMonitorDelay] = useState(5);
  const [monitorTimeout, setMonitorTimeout] = useState(3);
  const [monitorMaxRetries, setMonitorMaxRetries] = useState(3);
  const [monitorMaxRetriesDown, setMonitorMaxRetriesDown] = useState(3);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCreateSection, setActiveCreateSection] = useState('lb');
  const [showAssociateFloatingIpModal, setShowAssociateFloatingIpModal] = useState(false);
  const [selectedFloatingIpId, setSelectedFloatingIpId] = useState('');
  const [activeLoadBalancerForFloating, setActiveLoadBalancerForFloating] = useState(null);

  const subnetNameMap = useMemo(() => {
    return Object.fromEntries(subnets.map((item) => [item.id, item.name || item.id]));
  }, [subnets]);

  const availableFloatingIPs = useMemo(
    () => floatingIPs.filter((item) => !item.port_id),
    [floatingIPs]
  );

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [lbs, networkItems, serverItems, floatingIpItems] = await Promise.all([
          fetchLoadBalancers(token),
          fetchNetworks(token),
          fetchServers(token),
          fetchFloatingIPs(token)
        ]);

        const subnetGroups = await Promise.all(
          (networkItems || []).map((network) => fetchSubnets(token, network.id))
        );

        const mergedSubnets = subnetGroups.flat();

        if (!mounted) {
          return;
        }

        setLoadBalancers(lbs || []);
        setNetworks(networkItems || []);
        setServers(serverItems || []);
        setFloatingIPs(floatingIpItems || []);
        setSubnets(mergedSubnets || []);

        if (!lbSubnetId && mergedSubnets?.length) {
          setLbSubnetId(mergedSubnets[0].id);
        }
      } catch (e) {
        showNotification('error', e.response?.data?.message || e.message || 'Không tải được dữ liệu LB.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

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

    setMemberPorts((prev) => {
      if (!checked) {
        const cloned = { ...prev };
        delete cloned[serverId];
        return cloned;
      }

      if (prev[serverId]) {
        return prev;
      }

      return {
        ...prev,
        [serverId]: listenerPort
      };
    });
  }

  function updateServerPort(serverId, value) {
    const nextPort = toNumber(value, 80);

    setMemberPorts((prev) => ({
      ...prev,
      [serverId]: nextPort
    }));
  }

  function toggleLoadBalancer(loadBalancerId, checked) {
    setSelectedLoadBalancerIds((prev) => {
      if (checked) {
        if (prev.includes(loadBalancerId)) {
          return prev;
        }

        return [...prev, loadBalancerId];
      }

      return prev.filter((id) => id !== loadBalancerId);
    });
  }

  async function waitForLoadBalancerActive(loadbalancerId, timeoutMs = 180000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const detail = await fetchLoadBalancerDetail(token, loadbalancerId);
      const status = detail?.provisioning_status;

      if (status === 'ACTIVE') {
        return detail;
      }

      if (status === 'ERROR') {
        throw new Error('Load balancer rơi vào trạng thái ERROR.');
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.warn('Load balancer chưa ACTIVE sau 180 giây, tiếp tục tạo workflow...');
    return null;
  }

  async function resolveServerFixedIp(serverId, preferredSubnetId, serverPortsMap = null) {
    let ports;
    
    if (serverPortsMap && serverPortsMap[serverId]) {
      ports = serverPortsMap[serverId];
    } else {
      ports = await fetchPorts(token, { device_id: serverId });
    }
    
    const fixedIps = (ports || []).flatMap((port) => port.fixed_ips || []);

    const preferred = fixedIps.find((item) => item.subnet_id === preferredSubnetId);
    if (preferred?.ip_address) {
      return {
        ipAddress: preferred.ip_address,
        subnetId: preferred.subnet_id
      };
    }

    if (fixedIps[0]?.ip_address) {
      return {
        ipAddress: fixedIps[0].ip_address,
        subnetId: fixedIps[0].subnet_id
      };
    }

    return null;
  }

  async function batchFetchServerPorts(serverIds) {
    try {
      const portResults = await Promise.all(
        serverIds.map((serverId) => 
          fetchPorts(token, { device_id: serverId })
            .catch((e) => {
              console.error(`Lỗi khi fetch ports cho server ${serverId}:`, e);
              return [];
            })
        )
      );
      
      const portMap = {};
      serverIds.forEach((serverId, index) => {
        portMap[serverId] = portResults[index];
      });
      
      return portMap;
    } catch (e) {
      console.error('Lỗi batch fetch ports:', e);
      return {};
    }
  }

  async function handleCreateFullLoadBalancer() {
    if (!lbName.trim() || !lbSubnetId) {
      showNotification('error', 'Vui lòng nhập Load Balancer name và chọn subnet.');
      return false;
    }

    if (!isUuid(lbSubnetId)) {
      showNotification('error', 'vip_subnet_id không đúng định dạng UUID.');
      return false;
    }

    if (!listenerName.trim() || !listenerPort) {
      showNotification('error', 'Vui lòng nhập listener detail hợp lệ.');
      return false;
    }

    if (!poolName.trim()) {
      showNotification('error', 'Vui lòng nhập tên pool.');
      return false;
    }

    if (!selectedServerIds.length) {
      showNotification('error', 'Vui lòng chọn ít nhất 1 máy cho pool member.');
      return false;
    }

    setProcessing(true);

    try {
      showNotification('info', 'Đang tải thông tin các server...');
      const serverPortsMap = await batchFetchServerPorts(selectedServerIds);

      // Build members array with proper subnet_id
      const members = [];
      for (const serverId of selectedServerIds) {
        const memberAddress = await resolveServerFixedIp(serverId, lbSubnetId, serverPortsMap);

        if (!memberAddress?.ipAddress || !memberAddress?.subnetId) {
          throw new Error(`Không tìm thấy fixed IP cho server ${serverId}.`);
        }

        members.push({
          address: memberAddress.ipAddress,
          protocol_port: toNumber(memberPorts[serverId], toNumber(listenerPort, 80)),
          subnet_id: memberAddress.subnetId
        });
      }

      // Build nested health monitor payload
      const healthmonitorPayload = {
        type: monitorType,
        delay: toNumber(monitorDelay, 5),
        timeout: toNumber(monitorTimeout, 3),
        max_retries: toNumber(monitorMaxRetries, 3)
      };

      if (toNumber(monitorMaxRetriesDown, 0) > 0) {
        healthmonitorPayload.max_retries_down = toNumber(monitorMaxRetriesDown, 3);
      }

      // Build nested pool payload with members and healthmonitor
      const poolPayload = {
        protocol: poolProtocol,
        lb_algorithm: poolAlgorithm,
        members,
        healthmonitor: healthmonitorPayload
      };

      if (poolName.trim()) {
        poolPayload.name = poolName.trim();
      }

      // Build nested listener payload with default_pool
      const listenerPayload = {
        protocol: listenerProtocol,
        protocol_port: toNumber(listenerPort, 80),
        default_pool: poolPayload
      };

      if (listenerName.trim()) {
        listenerPayload.name = listenerName.trim();
      }

      // Build full load balancer payload with nested listener
      const lbPayload = {
        vip_subnet_id: lbSubnetId,
        listeners: [listenerPayload]
      };

      if (lbName.trim()) {
        lbPayload.name = lbName.trim();
      }
      if (lbDescription.trim()) {
        lbPayload.description = lbDescription.trim();
      }
      if (lbProvider.trim()) {
        lbPayload.provider = lbProvider.trim();
      }
      if (!lbAdminStateUp) {
        lbPayload.admin_state_up = false;
      }

      showNotification('info', 'Đang tạo toàn bộ Load Balancer với Listener, Pool, Members và Monitor...');
      const createdLoadBalancer = await createLoadBalancer(token, lbPayload);
      
      showNotification('info', 'Tạo Load Balancer thành công, đang chờ nó ACTIVE...');
      await waitForLoadBalancerActive(createdLoadBalancer.id);

      showNotification('info', 'Đang cập nhật danh sách...');
      const latest = await fetchLoadBalancers(token);
      setLoadBalancers(latest || []);

      showNotification('success', 'Tạo toàn bộ Load Balancer, Listener, Pool, Members và Monitor trong một lệnh duy nhất thành công!');
      return true;
    } catch (e) {
      showNotification('error', e.response?.data?.message || e.message || 'Không tạo được Load Balancer workflow.');
      return false;
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteSelectedLoadBalancers() {
    if (!selectedLoadBalancerIds.length) {
      showNotification('error', 'Vui lòng chọn load balancer cần xóa.');
      return;
    }

    setProcessing(true);
    try {
      await Promise.all(
        selectedLoadBalancerIds.map((loadBalancerId) =>
          deleteLoadBalancer(token, loadBalancerId, { cascade: true })
        )
      );

      const latest = await fetchLoadBalancers(token);
      setLoadBalancers(latest || []);
      setSelectedLoadBalancerIds([]);
      showNotification('success', 'Xóa load balancer đã chọn thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || e.message || 'Không xóa được load balancer.');
    } finally {
      setProcessing(false);
    }
  }

  function getLoadBalancerFloatingIps(loadBalancer) {
    if (!loadBalancer?.vip_port_id) {
      return [];
    }

    return floatingIPs.filter((item) => item.port_id === loadBalancer.vip_port_id);
  }

  function openAssociateFloatingIpModal(loadBalancer) {
    setActiveLoadBalancerForFloating(loadBalancer);
    setSelectedFloatingIpId('');
    setShowAssociateFloatingIpModal(true);
  }

  async function handleAssociateFloatingIpToLoadBalancer() {
    if (!activeLoadBalancerForFloating?.vip_port_id) {
      showNotification('error', 'Load balancer chưa có vip_port_id để gắn floating IP.');
      return;
    }

    if (!selectedFloatingIpId) {
      showNotification('error', 'Vui lòng chọn floating IP.');
      return;
    }

    setProcessing(true);
    try {
      await updateFloatingIP(token, selectedFloatingIpId, {
        port_id: activeLoadBalancerForFloating.vip_port_id
      });

      const latestFloatingIPs = await fetchFloatingIPs(token);
      const latestLBs = await fetchLoadBalancers(token);
      setFloatingIPs(latestFloatingIPs || []);
      setLoadBalancers(latestLBs || []);

      setShowAssociateFloatingIpModal(false);
      setActiveLoadBalancerForFloating(null);
      setSelectedFloatingIpId('');
      showNotification('success', 'Gắn floating IP cho load balancer thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || e.message || 'Không gắn được floating IP cho load balancer.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Đang tải Load Balancer...</p>;
  }

  const createSections = [
    { key: 'lb', label: 'Load Balancer Detail' },
    { key: 'listener', label: 'Listener Detail' },
    { key: 'pool', label: 'Pool Detail' },
    { key: 'member', label: 'Pool Member' },
    { key: 'monitor', label: 'Monitor Detail' }
  ];

  return (
    <section className="network-page">
      <h2>Load Balancer Manager</h2>

      <div className="network-toolbar">
        <button
          type="button"
          className="btn primary"
          disabled={processing}
          onClick={() => {
            setActiveCreateSection('lb');
            setShowCreateModal(true);
          }}
        >
          Thêm
        </button>
        <button
          type="button"
          className="btn"
          disabled={processing || !selectedLoadBalancerIds.length}
          onClick={handleDeleteSelectedLoadBalancers}
        >
          Xóa đã chọn
        </button>
      </div>

      <div className="network-list">
        <h3>Load Balancers hiện có</h3>
        <table>
          <thead>
            <tr>
              <th>Chọn</th>
              <th>Tên</th>
              <th>ID</th>
              <th>VIP</th>
              <th>Floating IP</th>
              <th>Provisioning</th>
              <th>Operating</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loadBalancers.map((lb) => (
              <tr key={lb.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedLoadBalancerIds.includes(lb.id)}
                    onChange={(e) => toggleLoadBalancer(lb.id, e.target.checked)}
                  />
                </td>
                <td>{lb.name || '-'}</td>
                <td>{lb.id}</td>
                <td>{lb.vip_address || '-'} ({subnetNameMap[lb.vip_subnet_id] || lb.vip_subnet_id || '-'})</td>
                <td>
                  {getLoadBalancerFloatingIps(lb)
                    .map((item) => item.floating_ip_address)
                    .filter(Boolean)
                    .join(', ') || '-'}
                </td>
                <td>{lb.provisioning_status || '-'}</td>
                <td>{lb.operating_status || '-'}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    disabled={processing || !lb.vip_port_id || !availableFloatingIPs.length}
                    onClick={() => openAssociateFloatingIpModal(lb)}
                  >
                    Gắn Floating IP
                  </button>
                </td>
              </tr>
            ))}
            {!loadBalancers.length && (
              <tr>
                <td colSpan={8}>Chưa có load balancer nào.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h3>Thông tin mạng khả dụng</h3>
        <p>
          <strong>Networks:</strong> {networks.length}
        </p>
        <p>
          <strong>Subnets:</strong> {subnets.length}
        </p>
        <p>
          <strong>Instances:</strong> {servers.length}
        </p>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !processing && setShowCreateModal(false)}>
          <div className="modal-content lb-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo Load Balancer</h3>
              <button className="modal-close" disabled={processing} onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body lb-create-body">
              <aside className="lb-create-sidebar">
                {createSections.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    className={`btn ${activeCreateSection === section.key ? 'primary' : ''}`}
                    onClick={() => setActiveCreateSection(section.key)}
                  >
                    {section.label}
                  </button>
                ))}
              </aside>

              <div className="lb-create-content">
                {activeCreateSection === 'lb' && (
                  <div className="detail-actions">
                    <h3>Load Balancer Detail (5 thuộc tính + subnet)</h3>
                    <div className="form-group">
                      <label>Tên Load Balancer</label>
                      <input value={lbName} onChange={(e) => setLbName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Mô tả</label>
                      <input value={lbDescription} onChange={(e) => setLbDescription(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Subnet</label>
                      <select value={lbSubnetId} onChange={(e) => setLbSubnetId(e.target.value)}>
                        {subnets.map((subnet) => (
                          <option key={subnet.id} value={subnet.id}>
                            {(subnet.name || subnet.id)} - {subnet.cidr || '-'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Provider</label>
                      <input
                        value={lbProvider}
                        onChange={(e) => setLbProvider(e.target.value)}
                        placeholder="ovn / amphora"
                      />
                    </div>
                    <div className="form-group">
                      <label>Admin State</label>
                      <select
                        value={lbAdminStateUp ? 'up' : 'down'}
                        onChange={(e) => setLbAdminStateUp(e.target.value === 'up')}
                      >
                        <option value="up">UP</option>
                        <option value="down">DOWN</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeCreateSection === 'listener' && (
                  <div className="detail-actions">
                    <h3>Listener Detail (Protocol + Port)</h3>
                    <div className="form-group">
                      <label>Tên Listener</label>
                      <input value={listenerName} onChange={(e) => setListenerName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Protocol</label>
                      <select
                        value={listenerProtocol}
                        onChange={(e) => {
                          setListenerProtocol(e.target.value);
                          setPoolProtocol(e.target.value);
                        }}
                      >
                        <option value="HTTP">HTTP</option>
                        <option value="HTTPS">HTTPS</option>
                        <option value="TCP">TCP</option>
                        <option value="UDP">UDP</option>
                        <option value="TERMINATED_HTTPS">TERMINATED_HTTPS</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Port</label>
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={listenerPort}
                        onChange={(e) => setListenerPort(toNumber(e.target.value, 80))}
                      />
                    </div>
                  </div>
                )}

                {activeCreateSection === 'pool' && (
                  <div className="detail-actions">
                    <h3>Pool Detail (Thuật toán)</h3>
                    <div className="form-group">
                      <label>Tên Pool</label>
                      <input value={poolName} onChange={(e) => setPoolName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Protocol Pool</label>
                      <select value={poolProtocol} onChange={(e) => setPoolProtocol(e.target.value)}>
                        <option value="HTTP">HTTP</option>
                        <option value="HTTPS">HTTPS</option>
                        <option value="TCP">TCP</option>
                        <option value="UDP">UDP</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Thuật toán</label>
                      <select value={poolAlgorithm} onChange={(e) => setPoolAlgorithm(e.target.value)}>
                        <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                        <option value="LEAST_CONNECTIONS">LEAST_CONNECTIONS</option>
                        <option value="SOURCE_IP">SOURCE_IP</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeCreateSection === 'member' && (
                  <div className="detail-actions">
                    <h3>Pool Member (Thêm máy + đổi port)</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Chọn</th>
                          <th>Tên máy</th>
                          <th>Server ID</th>
                          <th>Port member</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servers.map((server) => (
                          <tr key={server.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedServerIds.includes(server.id)}
                                onChange={(e) => toggleServer(server.id, e.target.checked)}
                              />
                            </td>
                            <td>{server.name || '-'}</td>
                            <td>{server.id}</td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                max="65535"
                                value={memberPorts[server.id] || listenerPort}
                                onChange={(e) => updateServerPort(server.id, e.target.value)}
                                disabled={!selectedServerIds.includes(server.id)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeCreateSection === 'monitor' && (
                  <div className="detail-actions">
                    <h3>Monitor Detail (5 thuộc tính)</h3>
                    <div className="form-group">
                      <label>Type</label>
                      <select value={monitorType} onChange={(e) => setMonitorType(e.target.value)}>
                        <option value="HTTP">HTTP</option>
                        <option value="HTTPS">HTTPS</option>
                        <option value="TCP">TCP</option>
                        <option value="PING">PING</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Delay (s)</label>
                      <input
                        type="number"
                        min="1"
                        value={monitorDelay}
                        onChange={(e) => setMonitorDelay(toNumber(e.target.value, 5))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Timeout (s)</label>
                      <input
                        type="number"
                        min="1"
                        value={monitorTimeout}
                        onChange={(e) => setMonitorTimeout(toNumber(e.target.value, 3))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Max Retries</label>
                      <input
                        type="number"
                        min="1"
                        value={monitorMaxRetries}
                        onChange={(e) => setMonitorMaxRetries(toNumber(e.target.value, 3))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Max Retries Down</label>
                      <input
                        type="number"
                        min="1"
                        value={monitorMaxRetriesDown}
                        onChange={(e) => setMonitorMaxRetriesDown(toNumber(e.target.value, 3))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" disabled={processing} onClick={() => setShowCreateModal(false)}>
                Hủy
              </button>
              <button
                className="btn primary"
                disabled={processing}
                onClick={async () => {
                  const success = await handleCreateFullLoadBalancer();
                  if (success) {
                    setShowCreateModal(false);
                  }
                }}
              >
                {processing ? 'Đang tạo...' : 'Tạo Full Load Balancer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssociateFloatingIpModal && (
        <div className="modal-overlay" onClick={() => !processing && setShowAssociateFloatingIpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gắn Floating IP cho Load Balancer</h3>
              <button
                className="modal-close"
                disabled={processing}
                onClick={() => setShowAssociateFloatingIpModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Load Balancer</label>
                <input value={activeLoadBalancerForFloating?.name || activeLoadBalancerForFloating?.id || ''} disabled />
              </div>

              <div className="form-group">
                <label>VIP Port ID</label>
                <input value={activeLoadBalancerForFloating?.vip_port_id || ''} disabled />
              </div>

              <div className="form-group">
                <label>Chọn Floating IP</label>
                <select
                  value={selectedFloatingIpId}
                  onChange={(e) => setSelectedFloatingIpId(e.target.value)}
                >
                  <option value="">-- Chọn floating IP --</option>
                  {availableFloatingIPs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.floating_ip_address} ({item.id})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" disabled={processing} onClick={() => setShowAssociateFloatingIpModal(false)}>
                Hủy
              </button>
              <button
                className="btn primary"
                disabled={processing || !selectedFloatingIpId}
                onClick={handleAssociateFloatingIpToLoadBalancer}
              >
                {processing ? 'Đang xử lý...' : 'Gắn Floating IP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div
          className={`notification ${notification.type === 'success' ? 'notification-success' : 'notification-error'}`}
        >
          <div className="notification-content">
            <span className="notification-icon">{notification.type === 'success' ? '✓' : '✕'}</span>
            <p className="notification-message">{notification.message}</p>
          </div>
        </div>
      )}
    </section>
  );
}
