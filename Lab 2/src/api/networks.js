import axios from 'axios';
const NETWORK_URL = '/api/network/v2.0';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

// Network APIs
export async function fetchNetworks(token) {
  const response = await axios.get(`${NETWORK_URL}/networks`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.networks || [];
}

// Create a new network with a default subnet
export async function createNetwork(token, name) {
  const response = await axios.post(
    `${NETWORK_URL}/networks`,
    {
      network: {
        name,
        admin_state_up: true
      }
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.network;
}

// Delete multiple networks by their IDs
export async function deleteNetworks(token, networkIds) {
  await Promise.all(
    networkIds.map((id) =>
      axios.delete(`${NETWORK_URL}/networks/${id}`, {
        headers: {
          ...jsonHeaders,
          'X-Auth-Token': token
        }
      })
    )
  );
}

// Update network name
export async function updateNetworkName(token, networkId, name) {
  const response = await axios.put(
    `${NETWORK_URL}/networks/${networkId}`,
    {
      network: {
        name
      }
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.network;
}

// Fetch subnets for a specific network
export async function fetchSubnets(token, networkId) {
  const response = await axios.get(`${NETWORK_URL}/subnets`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params: {
      network_id: networkId
    }
  });

  return response.data?.subnets || [];
}

// Create a new subnet under a specific network
export async function createSubnet(token, payload) {
  const response = await axios.post(
    `${NETWORK_URL}/subnets`,
    {
      subnet: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.subnet;
}

// Update subnet information
export async function updateSubnet(token, subnetId, payload) {
  const response = await axios.put(
    `${NETWORK_URL}/subnets/${subnetId}`,
    {
      subnet: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.subnet;
}

// Delete one subnet by ID
export async function deleteSubnet(token, subnetId) {
  await axios.delete(`${NETWORK_URL}/subnets/${subnetId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

// Fetch floating IPs
export async function fetchFloatingIPs(token) {
  const response = await axios.get(`${NETWORK_URL}/floatingips`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.floatingips || [];
}

// Create a new floating IP
export async function createFloatingIP(token, payload) {
  const response = await axios.post(`${NETWORK_URL}/floatingips`, {
    floatingip: payload
  }, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.floatingip;
}

// Delete a floating IP by ID
export async function deleteFloatingIP(token, floatingIpId) {
  await axios.delete(`${NETWORK_URL}/floatingips/${floatingIpId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

// Update floating IP (associate/disassociate by port_id)
export async function updateFloatingIP(token, floatingIpId, payload) {
  const normalizedId = String(floatingIpId || '').trim();
  if (!normalizedId) {
    throw new Error('floatingIpId không hợp lệ.');
  }

  const requestBody = {
    floatingip: payload
  };
  const requestConfig = {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  };

  try {
    const response = await axios.put(
      `${NETWORK_URL}/floatingips/${encodeURIComponent(normalizedId)}`,
      requestBody,
      requestConfig
    );

    return response.data?.floatingip;
  } catch (error) {
    if (error?.response?.status !== 404) {
      throw error;
    }

    // Some gateways require a trailing slash for update routes.
    const retryResponse = await axios.put(
      `${NETWORK_URL}/floatingips/${encodeURIComponent(normalizedId)}/`,
      requestBody,
      requestConfig
    );

    return retryResponse.data?.floatingip;
  }
}

// Fetch ports, optionally filter by device_id (server id)
export async function fetchPorts(token, params = {}) {
  const response = await axios.get(`${NETWORK_URL}/ports`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });

  return response.data?.ports || [];
}

// Sercurity Group APIs
export async function fetchSecurityGroups(token) {
  const response = await axios.get(`${NETWORK_URL}/security-groups`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.security_groups || [];
}

// Create a new security group
export async function createSecurityGroup(token, name, description) {
  const response = await axios.post(`${NETWORK_URL}/security-groups`, {
    security_group: {
      name,
      description
    }
  }, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.security_group;
}

// Delete a security group by ID
export async function deleteSecurityGroup(token, securityGroupId) {
  await axios.delete(`${NETWORK_URL}/security-groups/${securityGroupId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

// fetch security group detail with rules
export async function fetchSecurityGroupRules(token, securityGroupId) {
  const response = await axios.get(`${NETWORK_URL}/security-groups/${securityGroupId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params: {
      security_group_id: securityGroupId
    }
  });

  return response.data?.security_group_rules || [];
}

// Create security group rule for a target security group
export async function createSecurityGroupRule(token, payload) {
  const response = await axios.post(
    `${NETWORK_URL}/security-group-rules`,
    {
      security_group_rule: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.security_group_rule;
}

// Delete security group rule by ID
export async function deleteSecurityGroupRule(token, ruleId) {
  await axios.delete(`${NETWORK_URL}/security-group-rules/${ruleId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

// Put a security group
export async function updateSecurityGroup(token, securityGroupId, name, description) {
  const response = await axios.put(`${NETWORK_URL}/security-groups/${securityGroupId}`, {
    security_group: {
      name,
      description
    }
  }, {
    headers: {
      'X-Auth-Token': token
    }
  });

  return response.data?.security_group;
}

// fetch routers
export async function fetchRouters(token) {
  const response = await axios.get(`${NETWORK_URL}/routers`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.routers || [];
}

// create a new router
export async function createRouter(token, payload) {
  const response = await axios.post(
    `${NETWORK_URL}/routers`,
    {
      router: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.router;
}

// delete a router by ID
export async function deleteRouter(token, routerId) {
  await axios.delete(`${NETWORK_URL}/routers/${routerId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

// fetch router interfaces
export async function fetchRouterInterfaces(token, routerId) {
  const response = await axios.get(`${NETWORK_URL}/routers/${routerId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.router?.interfaces || [];
}

// add interface to router
export async function addRouterInterface(token, routerId, payload) {
  const response = await axios.put(
    `${NETWORK_URL}/routers/${routerId}/add_router_interface`,
    payload,
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.router;
}

// remove interface from router
export async function removeRouterInterface(token, routerId, payload) {
  const response = await axios.put(
    `${NETWORK_URL}/routers/${routerId}/remove_router_interface`,
    payload,
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.router;
}