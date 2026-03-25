const COMPUTE_URL = 'https://cloud-compute.uitiot.vn/v2.1/';
const INDENTITY_URL = 'https://cloud-identity.uitiot.vn/v3/';
const IMAGE_URL	= 'https://cloud-image.uitiot.vn';
const LOAD_BALANCER_URL = 'https://cloud-loadbalancer.uitiot.vn';
const NETWORK_URL = 'https://cloud-network.uitiot.vn';
const PLACEMENT_URL = 'https://cloud-placement.uitiot.vn';
const VOLUMEV3_URL = 'https://cloud-volume.uitiot.vn/v3';

async function checkToken() {
    const response = await fetch(`${INDENTITY_URL}auth/tokens`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
            "auth": {
                "identity": {
                    "methods": ["password"],
                    "password": {
                        "user": {
                            "name": "24520358",
                            "domain": { "id": "default" },
                            "password": "DB25p8asJZ7rWHU9VgTw"
                        }
                    }
                },
                "scope": {
                    "project": {
                        "name": "NT533.Q21.G8",
                        "domain": { "id": "default" }
                    }
                }
            }
        })
    });

    return response.headers.get('X-subject-token');
}

// Liệt kê các Flavor, Image
async function listFlavor(xAuthToken) {
    const response = await fetch(`${COMPUTE_URL}flavors`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': xAuthToken
        }
    });

    const data = await response.json();
    return data?.flavors;
}

async function listImage(xAuthToken) {
    const response = await fetch(`${COMPUTE_URL}images`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': xAuthToken
        }
    });
    const data = await response.json();

    return data?.images;
}

async function startApp() {
    const xAuthToken = await checkToken();
    // console.log(await listFlavor(xAuthToken));
    // console.log(await listImage(xAuthToken));
}

await startApp();