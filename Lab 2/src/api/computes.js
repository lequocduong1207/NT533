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

// fetch server detail by ID
export async function fetchServerDetail(token, serverId) {
  const response = await axios.get(`${COMPUTE_URL}/servers/${serverId}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.server;
}

// create a new server
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

// delete servers by IDs
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

// start a server by ID
export async function startServer(token, serverId) {
  const response = await axios.post(`${COMPUTE_URL}/servers/${serverId}/action`, {
    'os-start': null
  }, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  if (response.status !== 202) {
    throw new Error('Không thể khởi động server.');
  }

  return true;
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

// fetch keypairs
export async function fetchKeypairs(token) {
  const response = await axios.get(`${COMPUTE_URL}/os-keypairs`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });


  return response.data?.keypairs || [];
}

// create a new keypair
export async function createKeypair(token, name) {
  const response = await axios.post(`${COMPUTE_URL}/os-keypairs`, {
    keypair: {
      name
    }
  }, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.keypair;
}

// show keypair detail
export async function fetchKeypairDetail(token, keypairName) {
  const response = await axios.get(`${COMPUTE_URL}/os-keypairs/${keypairName}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });

  return response.data?.keypair;
}

// delete keypair by name
export async function deleteKeypair(token, keypairName) {
  await axios.delete(`${COMPUTE_URL}/os-keypairs/${keypairName}`, {
    headers: {
      ...jsonHeaders,
      'X-Auth-Token': token
    }
  });
}


