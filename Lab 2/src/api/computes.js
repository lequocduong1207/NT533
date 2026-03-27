import axios from 'axios';
const COMPUTE_URL = '/api/compute/v2.1';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

// fetch servers
export async function fetchServers(token) {
  const response = await axios.get(`${COMPUTE_URL}/servers/detail`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.servers || [];
}

export async function fetchServerDetail(token, serverId) {
  const response = await axios.get(`${COMPUTE_URL}/servers/${serverId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.server;
}

export async function createServer(token, payload) {
  const response = await axios.post(
    `${COMPUTE_URL}/servers`,
    {
      server: payload
    },
    {
      headers: {
        ...jsonHeaders,
        'X-Auth-Token': token
      }
    }
  );

  return response.data?.server;
}

export async function deleteServers(token, serverIds) {
  await Promise.all(
    serverIds.map((serverId) =>
      axios.delete(`${COMPUTE_URL}/servers/${serverId}`, {
        headers: {
          ...jsonHeaders,
          'X-Auth-Token': token
        }
      })
    )
  );
}

// fetch flavors
export async function fetchFlavors(token) {
  const response = await axios.get(`${COMPUTE_URL}/flavors`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.flavors || [];
}

// fetch images
export async function fetchImages(token) {
  const response = await axios.get(`${COMPUTE_URL}/images`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.images || [];
}
