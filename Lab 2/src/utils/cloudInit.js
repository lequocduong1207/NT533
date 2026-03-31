function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function encodeBase64Utf8(content) {
  return window.btoa(unescape(encodeURIComponent(content)));
}

export function buildCloudInit(instanceName, publicKey = null) {
  const safeInstanceName = escapeHtml(instanceName || 'unknown-instance');
  const htmlContent = `<!doctype html>
<html>
  <head>
    <meta charset='utf-8' />
    <title>NT533 VM</title>
  </head>
  <body>
    <h1>NT533.Q21.G8</h1>
    <p>Instance: ${safeInstanceName}</p>
    <p>IP: __IP_ADDR__</p>
  </body>
</html>`;
  const htmlContentB64 = encodeBase64Utf8(htmlContent);
  const normalizedPublicKey = publicKey?.replace(/\r?\n/g, '').trim();

  let script = `#cloud-config

# Set DNS FIRST (bootcmd) before package_update
bootcmd:
  - |
    echo "nameserver 8.8.8.8" > /etc/resolv.conf.new
    echo "nameserver 1.1.1.1" >> /etc/resolv.conf.new
    if [ -f /etc/resolv.conf ]; then
      grep -v "^nameserver" /etc/resolv.conf >> /etc/resolv.conf.new 2>/dev/null || true
    fi
    mv /etc/resolv.conf.new /etc/resolv.conf

# Update packages
package_update: true
package_upgrade: true
write_files:
  - path: /var/www/html/index.html
    owner: root:root
    permissions: '0644'
    encoding: b64
    content: ${htmlContentB64}
`;

  if (normalizedPublicKey) {
    script += `ssh_authorized_keys:
  - ${normalizedPublicKey}
`;
  }

  script += `runcmd:
  # Install nginx (multi-distro)
  - |
    if command -v apt-get >/dev/null 2>&1; then
      apt-get install -y nginx
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y nginx
    elif command -v yum >/dev/null 2>&1; then
      yum install -y nginx
    fi

  # Enable and restart SSH
  - |
    if systemctl list-unit-files | grep -q "^ssh.service"; then
      systemctl enable ssh
      systemctl restart ssh
    elif systemctl list-unit-files | grep -q "^sshd.service"; then
      systemctl enable sshd
      systemctl restart sshd
    fi

  # Enable and restart nginx
  - systemctl enable nginx || true
  - systemctl restart nginx || true

  # Create web page
  - |
    IP_ADDR=$(hostname -I | awk '{print $1}')
    sed -i "s|__IP_ADDR__|$IP_ADDR|g" /var/www/html/index.html
`;

  return script;
}

export function buildCloudInitUserData(instanceName, publicKey = null) {
  return encodeBase64Utf8(buildCloudInit(instanceName, publicKey));
}