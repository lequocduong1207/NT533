import axios from 'axios';

const IDENTITY_URL = '/api/identity/v3';
const COMPUTE_URL = '/api/compute/v2.1';
const NETWORK_URL = '/api/network/v2.0';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

function withQuery(url, query = {}, fields = []) {
  const search = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    search.append(key, String(value));
  });

  if (Array.isArray(fields)) {
    fields.forEach((field) => {
      if (field) {
        search.append('fields', field);
      }
    });
  }

  const queryString = search.toString();
  if (!queryString) {
    return url;
  }

  return `${url}?${queryString}`;
}

export async function fetchCheckToken(username, password) {
  const response = await axios.post(
    `${IDENTITY_URL}/auth/tokens`,
    {
      auth: {
        identity: {
          methods: ['password'],
          password: {
            user: {
              name: username,
              domain: { id: 'default' },
              password
            }
          }
        },
        scope: {
          project: {
            name: 'NT533.Q21.G8',
            domain: { id: 'default' }
          }
        }
      }
    },
    {
      headers: jsonHeaders
    }
  );

  return {
    status: response.status,
    token: response.headers['x-subject-token']
  };
}

export async function fetchNetworks(token) {
  const response = await axios.get(`${NETWORK_URL}/networks`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.networks || [];
}

export async function fetchRouters(token, query = {}) {
  const response = await axios.get(`${NETWORK_URL}/routers`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params: query
  });

  return response.data?.routers || [];
}

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

export async function deleteRouter(token, routerId) {
  await axios.delete(`${NETWORK_URL}/routers/${routerId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

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

export async function fetchFloatingIps(token, query = {}) {
  const response = await axios.get(`${NETWORK_URL}/floatingips`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params: query
  });

  return response.data?.floatingips || [];
}

export async function createFloatingIp(token, payload) {
  const response = await axios.post(
    `${NETWORK_URL}/floatingips`,
    {
      floatingip: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.floatingip;
}

export async function fetchFloatingIpDetail(token, floatingIpId, fields = []) {
  const params = {};
  if (Array.isArray(fields) && fields.length) {
    params.fields = fields;
  }

  const response = await axios.get(`${NETWORK_URL}/floatingips/${floatingIpId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    },
    params
  });

  return response.data?.floatingip;
}

export async function updateFloatingIp(token, floatingIpId, payload) {
  const response = await axios.put(
    `${NETWORK_URL}/floatingips/${floatingIpId}`,
    {
      floatingip: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.floatingip;
}

export async function deleteFloatingIp(token, floatingIpId) {
  await axios.delete(`${NETWORK_URL}/floatingips/${floatingIpId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

export async function fetchRouterConntrackHelpers(token, routerId, query = {}, fields = []) {
  const url = withQuery(`${NETWORK_URL}/routers/${routerId}/conntrack_helpers`, query, fields);
  const response = await axios.get(url, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.conntrack_helpers || [];
}

export async function createRouterConntrackHelper(token, routerId, payload) {
  const response = await axios.post(
    `${NETWORK_URL}/routers/${routerId}/conntrack_helpers`,
    {
      conntrack_helper: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.conntrack_helper;
}

export async function fetchRouterConntrackHelperDetail(
  token,
  routerId,
  conntrackHelperId,
  fields = []
) {
  const url = withQuery(
    `${NETWORK_URL}/routers/${routerId}/conntrack_helpers/${conntrackHelperId}`,
    {},
    fields
  );
  const response = await axios.get(url, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.conntrack_helper;
}

export async function updateRouterConntrackHelper(token, routerId, conntrackHelperId, payload) {
  const response = await axios.put(
    `${NETWORK_URL}/routers/${routerId}/conntrack_helpers/${conntrackHelperId}`,
    {
      conntrack_helper: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.conntrack_helper;
}

export async function deleteRouterConntrackHelper(token, routerId, conntrackHelperId) {
  await axios.delete(`${NETWORK_URL}/routers/${routerId}/conntrack_helpers/${conntrackHelperId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}

export async function fetchFlavors(token) {
  const response = await axios.get(`${COMPUTE_URL}/flavors`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.flavors || [];
}

export async function fetchImages(token) {
  const response = await axios.get(`${COMPUTE_URL}/images`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.images || [];
}
