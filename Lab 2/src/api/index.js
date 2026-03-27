import axios from 'axios';

const IDENTITY_URL = '/api/identity/v3';
const COMPUTE_URL = '/api/compute/v2.1';
const NETWORK_URL = '/api/network/v2.0';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

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
