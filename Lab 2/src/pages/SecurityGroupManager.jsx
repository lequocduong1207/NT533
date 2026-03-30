import { useEffect, useMemo, useState } from 'react';
import {
  fetchSecurityGroups,
  fetchSecurityGroupRules,
  createSecurityGroupRule,
  deleteSecurityGroupRule
} from '../api/networks';

const RULE_TYPE_PRESETS = {
  all: { protocol: '', portMin: '', portMax: '' },
  custom: { protocol: '', portMin: '', portMax: '' },
  icmp: { protocol: 'icmp', portMin: '', portMax: '' },
  tcp: { protocol: 'tcp', portMin: '', portMax: '' },
  udp: { protocol: 'udp', portMin: '', portMax: '' },
  http: { protocol: 'tcp', portMin: '80', portMax: '80' },
  https: { protocol: 'tcp', portMin: '443', portMax: '443' },
  ssh: { protocol: 'tcp', portMin: '22', portMax: '22' }
};

export default function SecurityGroupManager({ token }) {
  const [securityGroups, setSecurityGroups] = useState([]);
  const [groupRules, setGroupRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [notification, setNotification] = useState(null);

  const [newRuleDirection, setNewRuleDirection] = useState('ingress');
  const [newRuleEthertype, setNewRuleEthertype] = useState('IPv4');
  const [newRuleType, setNewRuleType] = useState('all');
  const [newRuleProtocol, setNewRuleProtocol] = useState('');
  const [newRulePortMin, setNewRulePortMin] = useState('');
  const [newRulePortMax, setNewRulePortMax] = useState('');
  const [newRuleCidr, setNewRuleCidr] = useState('0.0.0.0/0');

  const defaultGroup = useMemo(
    () => securityGroups.find((group) => group.name === 'default') || null,
    [securityGroups]
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const groups = await fetchSecurityGroups(token);
        if (!mounted) {
          return;
        }

        setSecurityGroups(groups || []);

        const defaultSg = (groups || []).find((group) => group.name === 'default');
        if (!defaultSg) {
          setGroupRules([]);
          showNotification('error', 'Không tìm thấy security group default.');
          return;
        }

        const rules = await fetchSecurityGroupRules(token, defaultSg.id);
        if (mounted) {
          setGroupRules(rules || []);
        }
      } catch (e) {
        if (mounted) {
          showNotification('error', e.response?.data?.message || 'Không tải được security group default.');
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
    setTimeout(() => setNotification(null), 3000);
  }

  function applyRuleTypePreset(type) {
    const preset = RULE_TYPE_PRESETS[type] || RULE_TYPE_PRESETS.all;
    setNewRuleType(type);
    setNewRuleProtocol(preset.protocol);
    setNewRulePortMin(preset.portMin);
    setNewRulePortMax(preset.portMax);
  }

  function normalizeRuleForComparison(rule) {
    return {
      direction: rule?.direction || 'ingress',
      ethertype: rule?.ethertype || 'IPv4',
      protocol: rule?.protocol || '',
      remote_ip_prefix: rule?.remote_ip_prefix || '',
      port_range_min:
        rule?.port_range_min == null || rule?.port_range_min === ''
          ? null
          : Number(rule.port_range_min),
      port_range_max:
        rule?.port_range_max == null || rule?.port_range_max === ''
          ? null
          : Number(rule.port_range_max)
    };
  }

  async function handleAddRule() {
    if (!defaultGroup) {
      showNotification('error', 'Không tìm thấy security group default.');
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        direction: newRuleDirection,
        ethertype: newRuleEthertype,
        security_group_id: defaultGroup.id,
        remote_ip_prefix: newRuleCidr
      };

      if (newRuleProtocol) {
        payload.protocol = newRuleProtocol;
      }

      if (newRulePortMin) {
        payload.port_range_min = parseInt(newRulePortMin, 10);
      }

      if (newRulePortMax) {
        payload.port_range_max = parseInt(newRulePortMax, 10);
      }

      const normalizedPayload = normalizeRuleForComparison(payload);
      const isDuplicated = groupRules.some((existing) => {
        const normalizedExisting = normalizeRuleForComparison(existing);
        return (
          normalizedExisting.direction === normalizedPayload.direction &&
          normalizedExisting.ethertype === normalizedPayload.ethertype &&
          normalizedExisting.protocol === normalizedPayload.protocol &&
          normalizedExisting.remote_ip_prefix === normalizedPayload.remote_ip_prefix &&
          normalizedExisting.port_range_min === normalizedPayload.port_range_min &&
          normalizedExisting.port_range_max === normalizedPayload.port_range_max
        );
      });

      if (isDuplicated) {
        showNotification('error', 'Rule đã tồn tại trong security group default.');
        return;
      }

      const created = await createSecurityGroupRule(token, payload);
      setGroupRules((prev) => [created, ...prev]);

      setNewRuleDirection('ingress');
      setNewRuleEthertype('IPv4');
      setNewRuleType('all');
      setNewRuleProtocol('');
      setNewRulePortMin('');
      setNewRulePortMax('');
      setNewRuleCidr('0.0.0.0/0');
      setShowAddRuleModal(false);

      showNotification('success', 'Thêm rule cho default thành công!');
    } catch (e) {
      if (e?.response?.status === 409) {
        showNotification('error', 'Rule bị trùng hoặc xung đột (409 Conflict). Vui lòng đổi protocol/port/cidr.');
      } else {
        showNotification('error', e.response?.data?.message || 'Không thêm được rule.');
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeleteRule(ruleId) {
    setProcessing(true);
    try {
      await deleteSecurityGroupRule(token, ruleId);
      setGroupRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      showNotification('success', 'Xóa rule thành công!');
    } catch (e) {
      showNotification('error', e.response?.data?.message || 'Không xóa được rule.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return <p>Đang tải...</p>;
  }

  return (
    <section className="securitygroup-section">
      <h3>Security Group (Default)</h3>

      <div className="toolbar">
        <button
          type="button"
          className="btn primary"
          disabled={processing || !defaultGroup}
          onClick={() => setShowAddRuleModal(true)}
        >
          Thêm Rule cho default
        </button>
      </div>

      <div className="group-detail">
        {!defaultGroup && <p>Không có security group default.</p>}

        {defaultGroup && (
          <>
            <p>
              <strong>Tên:</strong> {defaultGroup.name}
            </p>
            <p>
              <strong>ID:</strong> {defaultGroup.id}
            </p>

            <h4>Rules</h4>
            {groupRules.length === 0 && <p className="empty-message">Default chưa có rule nào.</p>}

            {groupRules.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Hướng</th>
                    <th>Protocol</th>
                    <th>Port</th>
                    <th>CIDR</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.direction || '-'}</td>
                      <td>{rule.protocol || 'all'}</td>
                      <td>
                        {rule.port_range_min != null && rule.port_range_max != null
                          ? `${rule.port_range_min}-${rule.port_range_max}`
                          : 'all'}
                      </td>
                      <td>{rule.remote_ip_prefix || '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn small danger"
                          onClick={() => handleDeleteRule(rule.id)}
                          disabled={processing}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {showAddRuleModal && (
        <div className="modal-overlay" onClick={() => setShowAddRuleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm Rule cho default</h3>
              <button className="modal-close" onClick={() => setShowAddRuleModal(false)}>
                x
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="rule-type">Loại Rule</label>
                <select
                  id="rule-type"
                  value={newRuleType}
                  onChange={(e) => applyRuleTypePreset(e.target.value)}
                >
                  <option value="all">All (mọi protocol)</option>
                  <option value="icmp">ICMP</option>
                  <option value="tcp">TCP (tự nhập port)</option>
                  <option value="udp">UDP (tự nhập port)</option>
                  <option value="http">HTTP (TCP 80)</option>
                  <option value="https">HTTPS (TCP 443)</option>
                  <option value="ssh">SSH (TCP 22)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rule-direction">Hướng</label>
                <select
                  id="rule-direction"
                  value={newRuleDirection}
                  onChange={(e) => setNewRuleDirection(e.target.value)}
                >
                  <option value="ingress">Ingress</option>
                  <option value="egress">Egress</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rule-ethertype">Ether Type</label>
                <select
                  id="rule-ethertype"
                  value={newRuleEthertype}
                  onChange={(e) => setNewRuleEthertype(e.target.value)}
                >
                  <option value="IPv4">IPv4</option>
                  <option value="IPv6">IPv6</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rule-protocol">Protocol</label>
                <select
                  id="rule-protocol"
                  value={newRuleProtocol}
                  onChange={(e) => {
                    setNewRuleType('custom');
                    setNewRuleProtocol(e.target.value);
                  }}
                >
                  <option value="">all</option>
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="icmp">ICMP</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rule-port-min">Port Min</label>
                <input
                  id="rule-port-min"
                  type="number"
                  value={newRulePortMin}
                  onChange={(e) => {
                    setNewRuleType('custom');
                    setNewRulePortMin(e.target.value);
                  }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-port-max">Port Max</label>
                <input
                  id="rule-port-max"
                  type="number"
                  value={newRulePortMax}
                  onChange={(e) => {
                    setNewRuleType('custom');
                    setNewRulePortMax(e.target.value);
                  }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-cidr">CIDR</label>
                <input
                  id="rule-cidr"
                  type="text"
                  value={newRuleCidr}
                  onChange={(e) => setNewRuleCidr(e.target.value)}
                  placeholder="0.0.0.0/0"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setShowAddRuleModal(false)}>
                Hủy
              </button>
              <button className="btn primary" disabled={processing} onClick={handleAddRule}>
                Thêm Rule
              </button>
            </div>
          </div>
        </div>
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
