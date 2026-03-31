# Lab 2 - Cloud Management UI

Frontend app built with React + Vite for managing cloud resources via API gateway.

## Tech Stack

- React 18
- Vite 5
- Axios
- React Router

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

4. Preview production build:

```bash
npm run preview
```

## API Proxy

Configured in vite.config.js:

- /api/identity -> https://cloud-identity.uitiot.vn
- /api/compute -> https://cloud-compute.uitiot.vn
- /api/network -> https://cloud-network.uitiot.vn
- /api/load-balancer -> https://cloud-loadbalancer.uitiot.vn

## Main Pages

- ComputePage: create/start/delete instances, floating IP attach/detach
- NetworkPage / RouterPage: network and router management
- SecurityGroupManager / KeypairManager: security and keypair management
- FloatingIPManager: floating IP lifecycle and association
- LoadBalancerManager: full LB workflow + scale operations

## Scale Flow (LoadBalancerManager)

### Scale Up

- Scale Up opens a popup to configure VM creation fields:
  - name prefix
  - flavor
  - image
  - network
  - keypair
  - security group
  - member port
- Creates VM(s), waits for ACTIVE, then adds members to selected pool.

### Scale Down

- Scale Down opens a popup.
- Popup fetches current pool members from API and shows a selectable list.
- You can select member_id values to prioritize removal.
- If selected member count is less than required delta, system falls back to remove additional members by default order.

### Realtime Counters

- Current pool member count is synced periodically.
- Delta is shown as `desired - current`.

## Current Safety Behavior

- If member drain succeeds but member deletion fails during scale down, member is restored (admin_state_up=true, weight>=1) to avoid leaving it stuck offline.
- Load balancer floating IP attach action is blocked when LB already has a floating IP.

## Useful Script

- checkScaleDown.ps1: helper script used to validate scale-down behavior.
