import axios from 'axios';
const LBAAS_URL = '/api/load-balancer/v2/lbaas';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

// Load Balancers
export async function fetchLoadBalancers(token, params = {}) {
  const response = await axios.get(`${LBAAS_URL}/loadbalancers`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });

  return response.data?.loadbalancers || [];
}

export async function createLoadBalancer(token, payload) {
  const response = await axios.post(
    `${LBAAS_URL}/loadbalancers`,
    { loadbalancer: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.loadbalancer;
}

export async function fetchLoadBalancerDetail(token, loadbalancerId) {
  const response = await axios.get(`${LBAAS_URL}/loadbalancers/${loadbalancerId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.loadbalancer;
}

export async function updateLoadBalancer(token, loadbalancerId, payload) {
  const response = await axios.put(
    `${LBAAS_URL}/loadbalancers/${loadbalancerId}`,
    { loadbalancer: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.loadbalancer;
}

export async function deleteLoadBalancer(token, loadbalancerId, params = {}) {
  await axios.delete(`${LBAAS_URL}/loadbalancers/${loadbalancerId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });
}

export async function fetchLoadBalancerStats(token, loadbalancerId) {
  const response = await axios.get(`${LBAAS_URL}/loadbalancers/${loadbalancerId}/stats`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.stats || response.data;
}

export async function fetchLoadBalancerStatusTree(token, loadbalancerId) {
  const response = await axios.get(`${LBAAS_URL}/loadbalancers/${loadbalancerId}/status`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.statuses || response.data;
}

export async function failoverLoadBalancer(token, loadbalancerId) {
  await axios.put(
    `${LBAAS_URL}/loadbalancers/${loadbalancerId}/failover`,
    {},
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );
}

// Listeners
export async function fetchListeners(token, params = {}) {
  const response = await axios.get(`${LBAAS_URL}/listeners`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });

  return response.data?.listeners || [];
}

export async function createListener(token, payload) {
  const response = await axios.post(
    `${LBAAS_URL}/listeners`,
    { listener: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.listener;
}

export async function fetchListenerDetail(token, listenerId) {
  const response = await axios.get(`${LBAAS_URL}/listeners/${listenerId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.listener;
}

export async function updateListener(token, listenerId, payload) {
  const response = await axios.put(
    `${LBAAS_URL}/listeners/${listenerId}`,
    { listener: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.listener;
}

export async function deleteListener(token, listenerId) {
  await axios.delete(`${LBAAS_URL}/listeners/${listenerId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

export async function fetchListenerStats(token, listenerId) {
  const response = await axios.get(`${LBAAS_URL}/listeners/${listenerId}/stats`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.stats || response.data;
}

// Pools
export async function fetchPools(token, params = {}) {
  const response = await axios.get(`${LBAAS_URL}/pools`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });

  return response.data?.pools || [];
}

export async function createPool(token, payload) {
  const response = await axios.post(
    `${LBAAS_URL}/pools`,
    { pool: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.pool;
}

export async function fetchPoolDetail(token, poolId) {
  const response = await axios.get(`${LBAAS_URL}/pools/${poolId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.pool;
}

export async function updatePool(token, poolId, payload) {
  const response = await axios.put(
    `${LBAAS_URL}/pools/${poolId}`,
    { pool: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.pool;
}

export async function deletePool(token, poolId) {
  await axios.delete(`${LBAAS_URL}/pools/${poolId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

// Members
export async function fetchPoolMembers(token, poolId, params = {}) {
  const response = await axios.get(`${LBAAS_URL}/pools/${poolId}/members`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });

  return response.data?.members || [];
}

export async function createPoolMember(token, poolId, payload) {
  const response = await axios.post(
    `${LBAAS_URL}/pools/${poolId}/members`,
    { member: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.member;
}

export async function fetchPoolMemberDetail(token, poolId, memberId) {
  const response = await axios.get(`${LBAAS_URL}/pools/${poolId}/members/${memberId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.member;
}

export async function updatePoolMember(token, poolId, memberId, payload) {
  const response = await axios.put(
    `${LBAAS_URL}/pools/${poolId}/members/${memberId}`,
    { member: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.member;
}

export async function batchUpdatePoolMembers(token, poolId, members = []) {
  const response = await axios.put(
    `${LBAAS_URL}/pools/${poolId}/members`,
    { members },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.members || [];
}

export async function deletePoolMember(token, poolId, memberId) {
  await axios.delete(`${LBAAS_URL}/pools/${poolId}/members/${memberId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

// Health Monitors
export async function fetchHealthMonitors(token, params = {}) {
  const response = await axios.get(`${LBAAS_URL}/healthmonitors`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });

  return response.data?.healthmonitors || [];
}

export async function createHealthMonitor(token, payload) {
  const response = await axios.post(
    `${LBAAS_URL}/healthmonitors`,
    { healthmonitor: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.healthmonitor;
}

export async function fetchHealthMonitorDetail(token, healthmonitorId) {
  const response = await axios.get(`${LBAAS_URL}/healthmonitors/${healthmonitorId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.healthmonitor;
}

export async function updateHealthMonitor(token, healthmonitorId, payload) {
  const response = await axios.put(
    `${LBAAS_URL}/healthmonitors/${healthmonitorId}`,
    { healthmonitor: payload },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.healthmonitor;
}

export async function deleteHealthMonitor(token, healthmonitorId) {
  await axios.delete(`${LBAAS_URL}/healthmonitors/${healthmonitorId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}


