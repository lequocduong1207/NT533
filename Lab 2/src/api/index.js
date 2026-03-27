import axios from 'axios';

const IDENTITY_URL = '/api/identity/v3';

// Authentication
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
      headers: {
        contentType: 'application/json'
      }
    }
  );

  return {
    status: response.status,
    token: response.headers['x-subject-token']
  };
}
