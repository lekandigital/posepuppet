#!/bin/bash
# ProxyCommand for `Host box` (/etc/ssh/ssh_config.d/box.conf): SSH to the Ubuntu asset server
# through Cloudflare Access. Reference copy of the script the cloud environment's setup script
# installs at /usr/local/bin/box-ssh-proxy — see docs/cloud-environment/box-ssh-access.md.
#
# Why this version: Claude Code Cloud's egress proxy injects the Access service token for
# box-ssh.1001ud.me but cannot carry a WebSocket stream (it closes the connection right after
# the 101 upgrade), and cloudflared's SSH transport is WebSocket-only. Direct TLS to that host
# IS allowed by the environment's network policy, so when the Access service token is present
# in the environment (TUNNEL_SERVICE_TOKEN_ID / TUNNEL_SERVICE_TOKEN_SECRET, cloudflared's own
# variable names) cloudflared connects directly, bypassing the egress proxy for this one host.
set -u
host="${1:?usage: box-ssh-proxy <hostname>}"
key="$HOME/.ssh/box_ed25519"
if [ ! -s "$key" ]; then
  [ -n "${BOX_SSH_KEY_B64:-}" ] || { echo "box: BOX_SSH_KEY_B64 is not set in this cloud environment" >&2; exit 1; }
  mkdir -p -m 700 "$HOME/.ssh"
  (umask 077; printf '%s' "$BOX_SSH_KEY_B64" | base64 -d > "$key")
fi
# Pin the server's host key (StrictHostKeyChecking yes + HostKeyAlias box need a known_hosts entry).
# BOX_HOST_KEY holds the public host key line, e.g. the content of /etc/ssh/ssh_host_ed25519_key.pub
# on the box ("ssh-ed25519 AAAA...").
if [ -n "${BOX_HOST_KEY:-}" ] && ! grep -qs '^box ' "$HOME/.ssh/known_hosts"; then
  mkdir -p -m 700 "$HOME/.ssh"
  (umask 077; printf 'box %s\n' "$BOX_HOST_KEY" >> "$HOME/.ssh/known_hosts")
fi
if [ -n "${TUNNEL_SERVICE_TOKEN_ID:-}" ] && [ -n "${TUNNEL_SERVICE_TOKEN_SECRET:-}" ]; then
  # credentials in hand: direct to Cloudflare (the egress proxy cannot relay WebSockets)
  exec env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
    cloudflared access ssh --hostname "$host" --loglevel "${BOX_CLOUDFLARED_LOGLEVEL:-error}"
fi
# no token in the environment: the proxied path (works only if the egress proxy relays WebSockets)
exec cloudflared access ssh --hostname "$host" --loglevel "${BOX_CLOUDFLARED_LOGLEVEL:-error}"
