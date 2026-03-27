import axios from 'axios';
const NETWORK_URL = '/api/network/v2.0';

// Network APIs
export async function fetchNetworks(token) {
  const response = await axios.get(`${NETWORK_URL}/networks`, {
    headers: {
      contentType: 'application/json',
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
        contentType: 'application/json',
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
          contentType: 'application/json',
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
        contentType: 'application/json',
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.network;
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
        contentType: 'application/json',
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.subnet;
}

// Fetch subnets for a specific network
export async function fetchSubnets(token, networkId) {
  const response = await axios.get(`${NETWORK_URL}/subnets`, {
    headers: {
      contentType: 'application/json',
      'X-Auth-Token': token
    },
    params: {
      network_id: networkId
    }
  });

  return response.data?.subnets || [];
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
        contentType: 'application/json',
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
      contentType: 'application/json',
      'X-Auth-Token': token
    }
  });
}