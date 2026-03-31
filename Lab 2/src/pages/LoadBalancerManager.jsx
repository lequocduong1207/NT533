import { useEffect, useMemo, useState } from 'react';
import {
  createServer,
  deleteServers,
  fetchFlavors,
  fetchImages,
  fetchKeypairs,
  fetchServers
} from '../api/computes';
import {
  createPoolMember,
  deletePoolMember,
  createLoadBalancer,
  deleteLoadBalancer,
  fetchLoadBalancerDetail,
  fetchLoadBalancers,
  fetchPoolMembers,
  fetchPools,
  updatePoolMember,
} from '../api/loadBlancer';
import {
  fetchFloatingIPs,
  fetchNetworks,
  fetchPorts,
  fetchSecurityGroups,
  fetchSubnets,
  updateFloatingIP
} from '../api/networks';
import { buildCloudInitUserData } from '../utils/cloudInit';

const SCALE_ACTIVITY_LOGS_KEY = 'lb-scale-activity-logs';

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

function extractPoolMemberId(member) {
  return (
    member?.id ||
    member?.member_id ||
    member?.member?.id ||
    member?.member?.member_id ||
    null
  );
}

export default function LoadBalancerManager({ token }) {
  const [loadBalancers, setLoadBalancers] = useState([]);
  const [selectedLoadBalancerIds, setSelectedLoadBalancerIds] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [subnets, setSubnets] = useState([]);
  const [servers, setServers] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [images, setImages] = useState([]);
  const [keypairs, setKeypairs] = useState([]);
  const [securityGroups, setSecurityGroups] = useState([]);
  const [pools, setPools] = useState([]);
  const [floatingIPs, setFloatingIPs] = useState([]);

  const [scaleLoadBalancerId, setScaleLoadBalancerId] = useState('');
  const [scalePoolId, setScalePoolId] = useState('');
  const [desiredScaleCount, setDesiredScaleCount] = useState(1);
  const [scaleDownMembers, setScaleDownMembers] = useState([]);
  const [selectedScaleDownMemberIds, setSelectedScaleDownMemberIds] = useState([]);
  const [scaleDownMembersLoading, setScaleDownMembersLoading] = useState(false);
  const [currentPoolMemberCount, setCurrentPoolMemberCount] = useState(0);
  const [scaleNamePrefix, setScaleNamePrefix] = useState('web-tier');
  const [scaleFlavorId, setScaleFlavorId] = useState('');
  const [scaleImageId, setScaleImageId] = useState('');
  const [scaleNetworkId, setScaleNetworkId] = useState('');
  const [scaleKeypairName, setScaleKeypairName] = useState('');
  const [scaleSecurityGroupName, setScaleSecurityGroupName] = useState('default');
  const [scaleMemberPort, setScaleMemberPort] = useState(80);
  const [scaleActivityLogs, setScaleActivityLogs] = useState([]);
  const [lastPoolMemberSyncAt, setLastPoolMemberSyncAt] = useState(null);

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
  const [showScaleUpModal, setShowScaleUpModal] = useState(false);
  const [showScaleDownModal, setShowScaleDownModal] = useState(false);
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

  const poolsForSelectedLoadBalancer = useMemo(() => {
    if (!scaleLoadBalancerId) {
      return [];
    }

    return pools.filter((pool) => {
      const refs = pool?.loadbalancers || [];
      return refs.some((ref) => {
        if (typeof ref === 'string') {
          return ref === scaleLoadBalancerId;
        }

        return ref?.id === scaleLoadBalancerId;
      });
    });
  }, [pools, scaleLoadBalancerId]);

  const desiredPoolMemberCount = useMemo(
    () => Math.max(0, toNumber(desiredScaleCount, 1)),
    [desiredScaleCount]
  );

  const actualScaleDelta = useMemo(
    () => desiredPoolMemberCount - currentPoolMemberCount,
    [desiredPoolMemberCount, currentPoolMemberCount]
  );

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [
          lbs,
          networkItems,
          serverItems,
          floatingIpItems,
          poolItems,
          flavorItems,
          imageItems,
          keypairItems,
          securityGroupItems
        ] = await Promise.all([
          fetchLoadBalancers(token),
          fetchNetworks(token),
          fetchServers(token),
          fetchFloatingIPs(token),
          fetchPools(token),
          fetchFlavors(token),
          fetchImages(token),
          fetchKeypairs(token),
          fetchSecurityGroups(token)
        ]);

        const subnetGroups = await Promise.all(
          (networkItems || []).map((network) => fetchSubnets(token, network.id))
        );

        const mergedSubnets = subnetGroups.flat();

        if (!mounted) {
          return;
        }

        const loadBalancerItems = lbs || [];
        setLoadBalancers(loadBalancerItems);
        setNetworks(networkItems || []);
        setServers(serverItems || []);
        setFlavors(flavorItems || []);
        setImages(imageItems || []);
        setKeypairs(keypairItems || []);
        setSecurityGroups(securityGroupItems || []);
        setFloatingIPs(floatingIpItems || []);
        setPools(poolItems || []);
        setSubnets(mergedSubnets || []);

        if (!lbSubnetId && mergedSubnets?.length) {
          setLbSubnetId(mergedSubnets[0].id);
        }

        if (!scaleLoadBalancerId && loadBalancerItems.length) {
          setScaleLoadBalancerId(loadBalancerItems[0].id);
        }

        if (!scaleNetworkId && networkItems?.length) {
          setScaleNetworkId(networkItems[0].id);
        }

        if (!scaleFlavorId && flavorItems?.length) {
          setScaleFlavorId(flavorItems[0].id);
        }

        if (!scaleImageId && imageItems?.length) {
          setScaleImageId(imageItems[0].id);
        }

        if (!scaleKeypairName && keypairItems?.length) {
          const firstKeypair = (keypairItems || []).map((item) => item?.keypair || item).find((item) => item?.name);
          setScaleKeypairName(firstKeypair?.name || '');
        }

        if (!scaleSecurityGroupName && securityGroupItems?.length) {
          const defaultGroup = securityGroupItems.find((group) => group.name === 'default');
          setScaleSecurityGroupName(defaultGroup?.name || securityGroupItems[0]?.name || '');
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

  useEffect(() => {
    if (!scaleLoadBalancerId) {
      setScalePoolId('');
      return;
    }

    if (!poolsForSelectedLoadBalancer.length) {
      setScalePoolId('');
      return;
    }

    const exists = poolsForSelectedLoadBalancer.some((pool) => pool.id === scalePoolId);
    if (!exists) {
      setScalePoolId(poolsForSelectedLoadBalancer[0].id);
    }
  }, [scaleLoadBalancerId, scalePoolId, poolsForSelectedLoadBalancer]);

  useEffect(() => {
    let mounted = true;
    let intervalId;

    async function syncPoolMemberCount(silent = true) {
      if (!scalePoolId) {
        if (mounted) {
          setCurrentPoolMemberCount(0);
          setLastPoolMemberSyncAt(null);
        }
        return;
      }

      try {
        const members = await fetchPoolMembers(token, scalePoolId);
        if (!mounted) {
          return;
        }

        setCurrentPoolMemberCount((members || []).length);
        setLastPoolMemberSyncAt(new Date());
      } catch (e) {
        if (!mounted) {
          return;
        }

        setCurrentPoolMemberCount(0);
        if (!silent) {
          showNotification('error', e.response?.data?.message || 'Không tải được danh sách pool members.');
        }
      }
    }

    syncPoolMemberCount(false);
    intervalId = window.setInterval(() => {
      syncPoolMemberCount(true);
    }, 5000);

    return () => {
      mounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [token, scalePoolId]);

  useEffect(() => {
    setScaleDownMembers([]);
    setSelectedScaleDownMemberIds([]);
  }, [scalePoolId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SCALE_ACTIVITY_LOGS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setScaleActivityLogs(parsed.slice(0, 30));
      }
    } catch (e) {
      console.error('Không đọc được scale logs từ localStorage:', e);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SCALE_ACTIVITY_LOGS_KEY,
        JSON.stringify(scaleActivityLogs.slice(0, 30))
      );
    } catch (e) {
      console.error('Không lưu được scale logs vào localStorage:', e);
    }
  }, [scaleActivityLogs]);

  async function waitForServerActive(serverId, timeoutMs = 300000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const latestServers = await fetchServers(token);
      const target = (latestServers || []).find((server) => server.id === serverId);

      if (!target) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      if (target.status === 'ACTIVE') {
        return target;
      }

      if (target.status === 'ERROR') {
        throw new Error(`Server ${serverId} rơi vào trạng thái ERROR.`);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('Timeout chờ server ACTIVE khi scale.');
  }

  function appendScaleLog(message, level = 'info') {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      time: new Date().toLocaleTimeString('vi-VN')
    };

    setScaleActivityLogs((prev) => [entry, ...prev].slice(0, 30));
  }

  async function refreshScaleData() {
    const [latestServers, latestMembers, latestPools, latestFloatingIps] = await Promise.all([
      fetchServers(token),
      scalePoolId ? fetchPoolMembers(token, scalePoolId) : Promise.resolve([]),
      fetchPools(token),
      fetchFloatingIPs(token)
    ]);

    setServers(latestServers || []);
    setPools(latestPools || []);
    setFloatingIPs(latestFloatingIps || []);
    setCurrentPoolMemberCount((latestMembers || []).length);
    setLastPoolMemberSyncAt(new Date());
  }

  function buildScaleServerName(indexSeed) {
    const prefix = (scaleNamePrefix || 'web-tier').trim();
    const suffix = String(indexSeed).padStart(3, '0');
    return `${prefix}-${suffix}`;
  }

  async function handleScaleUp(targetCount) {
    if (!scaleFlavorId || !scaleImageId || !scaleNetworkId) {
      showNotification('error', 'Scale up cần chọn flavor, image và network.');
      return false;
    }

    const targetLoadBalancer = loadBalancers.find((item) => item.id === scaleLoadBalancerId);
    const preferredSubnetId = targetLoadBalancer?.vip_subnet_id || null;
    const delta = targetCount - currentPoolMemberCount;

    if (delta <= 0) {
      showNotification('success', 'Không cần scale up vì số lượng hiện tại đã đạt hoặc vượt mục tiêu.');
      return true;
    }

    setProcessing(true);
    try {
      appendScaleLog(`Bắt đầu scale up đến ${targetCount} VM trong pool.`, 'info');
      const selectedFlavor = flavors.find((item) => item.id === scaleFlavorId);
      const selectedImage = images.find((item) => item.id === scaleImageId);
      const selectedScaleKeypair = (keypairs || [])
        .map((item) => item?.keypair || item)
        .find((item) => item?.name === scaleKeypairName);
      const flavorDisk = Number(selectedFlavor?.disk ?? 0);
      const imageMinDisk = Number(selectedImage?.min_disk ?? selectedImage?.minDisk ?? 0);
      const volumeSize = Math.max(1, imageMinDisk || 10);

      for (let index = 0; index < delta; index += 1) {
        const nextIndex = servers.length + index + 1;
        const payload = {
          name: buildScaleServerName(nextIndex),
          flavorRef: scaleFlavorId,
          networks: [{ uuid: scaleNetworkId }],
          key_name: scaleKeypairName || undefined,
          security_groups: scaleSecurityGroupName ? [{ name: scaleSecurityGroupName }] : undefined,
          metadata: {
            scale_group: (scaleNamePrefix || 'web-tier').trim(),
            scale_pool_id: scalePoolId,
            scale_lb_id: scaleLoadBalancerId
          }
        };

        payload.user_data = buildCloudInitUserData(
          payload.name,
          selectedScaleKeypair?.public_key || null
        );

        if (flavorDisk === 0) {
          payload.block_device_mapping_v2 = [
            {
              uuid: scaleImageId,
              source_type: 'image',
              destination_type: 'volume',
              boot_index: 0,
              delete_on_termination: true,
              volume_size: volumeSize
            }
          ];
        } else {
          payload.imageRef = scaleImageId;
        }

        showNotification('info', `Đang tạo VM ${index + 1}/${delta}...`);
        appendScaleLog(`Tạo VM ${index + 1}/${delta}: ${payload.name}`, 'info');
        const createdServer = await createServer(token, payload);
        await waitForServerActive(createdServer.id);
        appendScaleLog(`VM ACTIVE: ${createdServer.id}`, 'success');

        const fixedIp = await resolveServerFixedIp(createdServer.id, preferredSubnetId);
        if (!fixedIp?.ipAddress || !fixedIp?.subnetId) {
          throw new Error(`Không tìm thấy fixed IP của server ${createdServer.id} để add vào pool.`);
        }

        await createPoolMember(token, scalePoolId, {
          address: fixedIp.ipAddress,
          protocol_port: toNumber(scaleMemberPort, 80),
          subnet_id: fixedIp.subnetId
        });
        appendScaleLog(`Đã add member ${fixedIp.ipAddress}:${toNumber(scaleMemberPort, 80)} vào pool.`, 'success');
      }

      await waitForLoadBalancerActive(scaleLoadBalancerId);
      await refreshScaleData();
      appendScaleLog('Scale up hoàn tất, đã đồng bộ dữ liệu mới nhất.', 'success');
      showNotification('success', 'Scale up thành công và đã tự thêm VM vào Load Balancer.');
      return true;
    } catch (e) {
      appendScaleLog(e.response?.data?.message || e.message || 'Scale up thất bại.', 'error');
      showNotification('error', e.response?.data?.message || e.message || 'Scale up thất bại.');
      return false;
    } finally {
      setProcessing(false);
    }
  }

  async function handleScaleDown(targetCount) {
    const delta = currentPoolMemberCount - targetCount;
    if (delta <= 0) {
      showNotification('success', 'Không cần scale down vì số lượng hiện tại không vượt mục tiêu.');
      return;
    }

    setProcessing(true);
    try {
      appendScaleLog(`Bắt đầu scale down về ${targetCount} VM trong pool.`, 'info');
      const members = await fetchPoolMembers(token, scalePoolId);
      const normalizedMembers = members || [];

      const memberById = new Map();
      normalizedMembers.forEach((item) => {
        const id = extractPoolMemberId(item);
        if (id) {
          memberById.set(id, item);
        }
      });

      let candidateMembers = [];
      if (selectedScaleDownMemberIds.length > 0) {
        const missingIds = [];
        selectedScaleDownMemberIds.forEach((id) => {
          const matched = memberById.get(id);
          if (matched) {
            candidateMembers.push(matched);
          } else {
            missingIds.push(id);
          }
        });

        if (missingIds.length > 0) {
          appendScaleLog(`Không tìm thấy member_id: ${missingIds.join(', ')}`, 'error');
        }

        const selectedIdsSet = new Set(candidateMembers.map((item) => extractPoolMemberId(item)).filter(Boolean));
        const fallbackMembers = normalizedMembers.filter((item) => !selectedIdsSet.has(extractPoolMemberId(item)));
        candidateMembers = [...candidateMembers, ...fallbackMembers].slice(0, delta);
      } else {
        candidateMembers = normalizedMembers.slice(-delta);
      }

      const allServers = await fetchServers(token);
      const serverByFixedIp = new Map();

      for (const server of allServers || []) {
        const ports = await fetchPorts(token, { device_id: server.id });
        const ips = (ports || []).flatMap((port) => port.fixed_ips || []).map((item) => item.ip_address);
        ips.forEach((ip) => {
          if (ip) {
            serverByFixedIp.set(ip, server);
          }
        });
      }

      const prefix = (scaleNamePrefix || 'web-tier').trim();

      for (const member of candidateMembers) {
        const memberId =
          extractPoolMemberId(member) ||
          extractPoolMemberId(
            normalizedMembers.find(
              (item) =>
                item?.address === member?.address &&
                Number(item?.protocol_port) === Number(member?.protocol_port)
            )
          );

        if (!memberId) {
          appendScaleLog(
            `Không lấy được member id cho ${member?.address || 'unknown-address'}, bỏ qua member này.`,
            'error'
          );
          continue;
        }

        // let isDrained = false;
        // try {
        //   // Drain nhẹ trước khi remove member để giảm rớt kết nối đột ngột.
        //   await updatePoolMember(token, scalePoolId, memberId, {
        //     admin_state_up: false,
        //     weight: 0
        //   });
        //   isDrained = true;
        //   appendScaleLog(`Drain member ${member.address} (${memberId}) trước khi xóa.`, 'info');
        // } catch (drainError) {
        //   appendScaleLog(`Không drain được member ${member.address}, vẫn tiếp tục remove.`, 'error');
        // }

        try {
          console.log(scalePoolId, " - ", memberId);
          await deletePoolMember(token, scalePoolId, memberId);
        } catch (deleteError) {
          if (isDrained) {
            try {
              // Khôi phục member nếu remove lỗi để tránh bị kẹt OFFLINE/weight=0.
              await updatePoolMember(token, scalePoolId, memberId, {
                admin_state_up: true,
                weight: Math.max(1, Number(member.weight || 1))
              });
              appendScaleLog(`Khôi phục member ${member.address} do xóa thất bại.`, 'info');
            } catch (restoreError) {
              appendScaleLog(`Không thể khôi phục member ${member.address} sau khi xóa lỗi.`, 'error');
            }
          }

          throw deleteError;
        }

        appendScaleLog(`Đã xóa pool member: ${member.address}`, 'success');

        const mappedServer = serverByFixedIp.get(member.address);
        const isScaleManaged =
          mappedServer?.name?.startsWith(prefix) ||
          mappedServer?.metadata?.scale_pool_id === scalePoolId;
        if (mappedServer?.id && isScaleManaged) {
          await deleteServers(token, [mappedServer.id]);
          appendScaleLog(`Đã xóa VM managed: ${mappedServer.name || mappedServer.id}`, 'success');
        } else {
          appendScaleLog(`Bỏ qua xóa VM cho member ${member.address} để tránh xóa nhầm.`, 'info');
        }
      }

      await waitForLoadBalancerActive(scaleLoadBalancerId);
      await refreshScaleData();
      appendScaleLog('Scale down hoàn tất, đã đồng bộ dữ liệu mới nhất.', 'success');
      showNotification('success', 'Scale down thành công và đã đồng bộ khỏi Load Balancer.');
    } catch (e) {
      appendScaleLog(e.response?.data?.message || e.message || 'Scale down thất bại.', 'error');
      showNotification('error', e.response?.data?.message || e.message || 'Scale down thất bại.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleScaleAction(direction) {
    if (!scaleLoadBalancerId || !scalePoolId) {
      showNotification('error', 'Vui lòng chọn load balancer và pool để scale.');
      return false;
    }

    const target = desiredPoolMemberCount;
    if (direction === 'up') {
      return handleScaleUp(target);
    }

    await handleScaleDown(target);
    return true;
  }

  function openScaleUpModal() {
    if (!scaleLoadBalancerId || !scalePoolId) {
      showNotification('error', 'Vui lòng chọn load balancer và pool trước khi scale up.');
      return;
    }

    setShowScaleUpModal(true);
  }

  async function openScaleDownModal() {
    if (!scaleLoadBalancerId || !scalePoolId) {
      showNotification('error', 'Vui lòng chọn load balancer và pool trước khi scale down.');
      return;
    }

    setScaleDownMembersLoading(true);
    try {
      const members = await fetchPoolMembers(token, scalePoolId);
      setScaleDownMembers(members || []);
      setSelectedScaleDownMemberIds([]);
      setShowScaleDownModal(true);
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không tải được danh sách member để scale down.');
    } finally {
      setScaleDownMembersLoading(false);
    }

  }

  function toggleScaleDownMemberId(memberId, checked) {
    setSelectedScaleDownMemberIds((prev) => {
      if (checked) {
        if (prev.includes(memberId)) {
          return prev;
        }

        return [...prev, memberId];
      }

      return prev.filter((id) => id !== memberId);
    });
  }

  async function handleReconcileScale() {
    if (!scaleLoadBalancerId || !scalePoolId) {
      showNotification('error', 'Vui lòng chọn load balancer và pool để reconcile.');
      return;
    }

    const target = desiredPoolMemberCount;
    appendScaleLog(`Bắt đầu reconcile về desired=${target}.`, 'info');

    if (currentPoolMemberCount === target) {
      appendScaleLog('Hệ thống đã ở trạng thái mong muốn, không cần thay đổi.', 'success');
      showNotification('success', 'Đã đạt desired count, không cần scale.');
      return;
    }

    if (currentPoolMemberCount < target) {
      await handleScaleUp(target);
      return;
    }

    await handleScaleDown(target);
  }

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

  function hasLoadBalancerFloatingIp(loadBalancer) {
    return getLoadBalancerFloatingIps(loadBalancer).length > 0;
  }

  function openAssociateFloatingIpModal(loadBalancer) {
    if (hasLoadBalancerFloatingIp(loadBalancer)) {
      showNotification('error', 'Load balancer đã có Floating IP, không thể gắn thêm.');
      return;
    }

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

    if (hasLoadBalancerFloatingIp(activeLoadBalancerForFloating)) {
      showNotification('error', 'Load balancer đã có Floating IP, không thể gắn thêm.');
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
                    disabled={processing || !lb.vip_port_id || !availableFloatingIPs.length || hasLoadBalancerFloatingIp(lb)}
                    onClick={() => openAssociateFloatingIpModal(lb)}
                  >
                    {hasLoadBalancerFloatingIp(lb) ? 'Đã có Floating IP' : 'Gắn Floating IP'}
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

        <h3>Scale VM Theo Load Balancer </h3>
        <div className="detail-actions">
          <div className="form-group">
            <label>Load Balancer</label>
            <select
              value={scaleLoadBalancerId}
              onChange={(e) => setScaleLoadBalancerId(e.target.value)}
              disabled={processing || !loadBalancers.length}
            >
              <option value="">-- Chọn load balancer --</option>
              {loadBalancers.map((lb) => (
                <option key={lb.id} value={lb.id}>
                  {lb.name || lb.id}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Pool</label>
            <select
              value={scalePoolId}
              onChange={(e) => setScalePoolId(e.target.value)}
              disabled={processing || !poolsForSelectedLoadBalancer.length}
            >
              <option value="">-- Chọn pool --</option>
              {poolsForSelectedLoadBalancer.map((pool) => (
                <option key={pool.id} value={pool.id}>
                  {pool.name || pool.id}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Desired VM Count</label>
            <input
              type="number"
              min="0"
              value={desiredScaleCount}
              onChange={(e) => setDesiredScaleCount(Math.max(0, toNumber(e.target.value, 1)))}
              disabled={processing}
            />
          </div>

          <p>
            <strong>Current pool members:</strong> {currentPoolMemberCount}
          </p>
          <p>
            <strong>Delta thực tế:</strong> {actualScaleDelta > 0 ? `+${actualScaleDelta}` : actualScaleDelta}
          </p>
          <p>
            <strong>Last sync:</strong> {lastPoolMemberSyncAt ? lastPoolMemberSyncAt.toLocaleTimeString('vi-VN') : '-'}
          </p>

          <div className="network-toolbar">
            <button
              type="button"
              className="btn primary"
              disabled={processing || !scaleLoadBalancerId || !scalePoolId}
              onClick={openScaleUpModal}
            >
              Scale Up
            </button>
            <button
              type="button"
              className="btn"
              disabled={processing || scaleDownMembersLoading || !scaleLoadBalancerId || !scalePoolId}
              onClick={openScaleDownModal}
            >
              Scale Down
            </button>
            <button
              type="button"
              className="btn"
              disabled={processing || !scaleLoadBalancerId || !scalePoolId}
              onClick={handleReconcileScale}
            >
              Reconcile
            </button>
          </div>

          <h4>Scale Activity Log</h4>
          {!scaleActivityLogs.length && <p>Chưa có hoạt động scale nào.</p>}
          {!!scaleActivityLogs.length && (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Level</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {scaleActivityLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.time}</td>
                    <td>{entry.level}</td>
                    <td>{entry.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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

      {showScaleUpModal && (
        <div className="modal-overlay" onClick={() => !processing && setShowScaleUpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cấu hình Scale Up</h3>
              <button
                className="modal-close"
                disabled={processing}
                onClick={() => setShowScaleUpModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>VM Name Prefix</label>
                <input
                  value={scaleNamePrefix}
                  onChange={(e) => setScaleNamePrefix(e.target.value)}
                  disabled={processing}
                  placeholder="web-tier"
                />
              </div>

              <div className="form-group">
                <label>Flavor</label>
                <select
                  value={scaleFlavorId}
                  onChange={(e) => setScaleFlavorId(e.target.value)}
                  disabled={processing || !flavors.length}
                >
                  <option value="">-- Chọn flavor --</option>
                  {flavors.map((flavor) => (
                    <option key={flavor.id} value={flavor.id}>
                      {flavor.name || flavor.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Image</label>
                <select
                  value={scaleImageId}
                  onChange={(e) => setScaleImageId(e.target.value)}
                  disabled={processing || !images.length}
                >
                  <option value="">-- Chọn image --</option>
                  {images.map((image) => (
                    <option key={image.id} value={image.id}>
                      {image.name || image.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Network</label>
                <select
                  value={scaleNetworkId}
                  onChange={(e) => setScaleNetworkId(e.target.value)}
                  disabled={processing || !networks.length}
                >
                  <option value="">-- Chọn network --</option>
                  {networks.map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.name || network.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Keypair</label>
                <select
                  value={scaleKeypairName}
                  onChange={(e) => setScaleKeypairName(e.target.value)}
                  disabled={processing}
                >
                  <option value="">-- Không dùng keypair --</option>
                  {(keypairs || []).map((item) => {
                    const keypair = item?.keypair || item;
                    return (
                      <option key={keypair.name} value={keypair.name}>
                        {keypair.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label>Security Group</label>
                <select
                  value={scaleSecurityGroupName}
                  onChange={(e) => setScaleSecurityGroupName(e.target.value)}
                  disabled={processing || !securityGroups.length}
                >
                  <option value="">-- Không gán SG --</option>
                  {securityGroups.map((group) => (
                    <option key={group.id || group.name} value={group.name}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Member Port</label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={scaleMemberPort}
                  onChange={(e) => setScaleMemberPort(toNumber(e.target.value, 80))}
                  disabled={processing}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" disabled={processing} onClick={() => setShowScaleUpModal(false)}>
                Hủy
              </button>
              <button
                className="btn primary"
                disabled={processing || !scaleLoadBalancerId || !scalePoolId}
                onClick={async () => {
                  const success = await handleScaleAction('up');
                  if (success) {
                    setShowScaleUpModal(false);
                  }
                }}
              >
                {processing ? 'Đang xử lý...' : 'Xác nhận Scale Up'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScaleDownModal && (
        <div className="modal-overlay" onClick={() => !processing && setShowScaleDownModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cấu hình Scale Down</h3>
              <button
                className="modal-close"
                disabled={processing}
                onClick={() => setShowScaleDownModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p>
                <strong>Current:</strong> {currentPoolMemberCount} | <strong>Desired:</strong> {desiredPoolMemberCount}
              </p>
              <h4>Chọn member_id để ưu tiên xóa (tùy chọn)</h4>
              {!scaleDownMembers.length && <p>Pool hiện chưa có member.</p>}
              {!!scaleDownMembers.length && (
                <table>
                  <thead>
                    <tr>
                      <th>Chọn</th>
                      <th>Member ID</th>
                      <th>Address</th>
                      <th>Port</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scaleDownMembers.map((member) => {
                      const memberId = extractPoolMemberId(member);
                      if (!memberId) {
                        return null;
                      }

                      return (
                        <tr key={memberId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedScaleDownMemberIds.includes(memberId)}
                              onChange={(e) => toggleScaleDownMemberId(memberId, e.target.checked)}
                              disabled={processing}
                            />
                          </td>
                          <td>{memberId}</td>
                          <td>{member.address || '-'}</td>
                          <td>{member.protocol_port || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <p>
                <strong>Đã nhận:</strong> {selectedScaleDownMemberIds.length} member_id
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn" disabled={processing} onClick={() => setShowScaleDownModal(false)}>
                Hủy
              </button>
              <button
                className="btn primary"
                disabled={processing || !scaleLoadBalancerId || !scalePoolId}
                onClick={async () => {
                  await handleScaleAction('down');
                  setShowScaleDownModal(false);
                }}
              >
                {processing ? 'Đang xử lý...' : 'Xác nhận Scale Down'}
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
