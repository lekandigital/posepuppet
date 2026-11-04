# `ssh box` from Claude Code Cloud — diagnosis and fix

_2026-11-04, cloud session on `bodyarcade-tidewater-cp10-controls-camera`. The Ubuntu asset
server ("box") is reached through Cloudflare Access SSH (`box-ssh.1001ud.me`). This records why
the connection fails from the cloud environment and the smallest change that makes it work._

## What the environment setup script does (reconstructed)

The environment manager ran the init script once at container build (`init_script_started`
10:19:05 → `init_script_exited` 10:19:09, 3.8 s, **exit without error**, 1035 bytes of output;
`/tmp/environment-manager.out`). Its footprint, from `/var/log/apt/history.log`, `dpkg.log` and
file timestamps (all 10:19:09):

| Step | Result |
|---|---|
| Cloudflare apt keyring + `/etc/apt/sources.list.d/cloudflared.list`, `apt-get install -y -qq cloudflared` | **ok** — cloudflared 2026.10.7 at `/usr/bin/cloudflared`, symlink `/usr/local/bin/cloudflared` |
| `/usr/local/bin/box-ssh-proxy` (decodes `BOX_SSH_KEY_B64` → `~/.ssh/box_ed25519` on first use, then `cloudflared access ssh --hostname %h`) | **ok** — the key decodes to a valid ED25519 key (comment "claude-code-cloud -> box (read-only sandbox as o)") |
| `/etc/ssh/ssh_config.d/box.conf` (`Host box`, user `o`, `ProxyCommand box-ssh-proxy`, `IdentityFile ${HOME}/.ssh/box_ed25519`, `StrictHostKeyChecking yes`, `HostKeyAlias box`) | **ok** — `ssh -G box` resolves every option |
| `openssh-client` | **missing** — not installed by the script and not in the image: there is no `ssh`, `scp` or `sftp` binary, so `ssh box` cannot even start (this session installed it by hand with `apt-get install -y openssh-client rsync`) |
| known host key for `box` | **missing** — no `/etc/ssh/ssh_known_hosts` and no `~/.ssh/known_hosts`; with `StrictHostKeyChecking yes` ssh will refuse the first connection even once the transport works |

## Why the transport fails

`ssh -vv box` ends with `websocket: bad handshake` from the ProxyCommand, then
`kex_exchange_identification: Connection closed by remote host`. The SSH layer never starts; the
failure is in cloudflared's WebSocket transport. Tested, without exposing credentials:

1. **cloudflared honours `HTTPS_PROXY`** (pointing it at a dead port gives `dial tcp 127.0.0.1:9:
   connect: connection refused`), so it does go through the session's egress proxy, which injects
   the Access service token for `box-ssh.1001ud.me`.
2. **Through the proxy the Access side works**: a plain `GET https://box-ssh.1001ud.me/` returns
   `200` (directly, without the proxy, Cloudflare Access answers `403` with `cf-access-domain`
   headers), and a hand-made WebSocket upgrade request receives `HTTP/1.1 101 Switching Protocols`
   with a correct `Sec-WebSocket-Accept`.
3. **But the proxy does not relay the upgraded stream**: it rewrites the 101 response (drops the
   `Upgrade` header, adds `Connection: close`) and closes the TLS connection immediately — zero
   bytes arrive after the handshake (the SSH banner never comes). cloudflared's validator sees the
   mangled 101 as "bad handshake"; a tolerant client sees an empty, closed stream. The proxy's own
   README (`/root/.ccr/README.md`) lists "WebSocket upgrades" under *not supported*.
4. **Direct connections to this host are allowed by the network policy**: `box-ssh.1001ud.me`
   resolves (non-allowed hosts do not) and TLS to Cloudflare succeeds — but the direct path has no
   credential (the service token lives only inside the proxy; `/cdn-cgi/access/get-identity` says
   `no app token set`, no `CF_Authorization` cookie is ever handed to the session), so Access
   refuses it. Port 22 anywhere is blocked. No Remote Control folders are offered to this session.

So: the only path that carries credentials cannot carry WebSockets, and the only path that can
carry WebSockets has no credentials. Nothing inside the session can fix that.

## Smallest corrective action

In the environment's settings (cloud environment menu in the session title bar → Edit):

1. **Environment variables / secrets**: add the Cloudflare Access service token for the
   `box-ssh.1001ud.me` application as `TUNNEL_SERVICE_TOKEN_ID` and `TUNNEL_SERVICE_TOKEN_SECRET`
   (the variable names cloudflared reads itself: `cloudflared access ssh --help`). Use a service
   token dedicated to this app so it can be rotated; the sandbox user on the box stays `o`
   (read-only). Optionally add `BOX_HOST_KEY` = the box's `ssh-ed25519 AAAA…` host public key
   (`cat /etc/ssh/ssh_host_ed25519_key.pub` on the box) so the pinned-host-key intent of the config
   is honoured; without it the ProxyCommand below leaves host-key checking as configured and the
   first connection must be made with `-o StrictHostKeyChecking=accept-new`.
2. **Setup script**: add `openssh-client` (and `rsync`) to the existing `apt-get install` line,
   and replace the `box-ssh-proxy` body with `docs/cloud-environment/box-ssh-proxy.sh` from this
   repository — when the token variables are present it runs cloudflared directly (proxy bypassed
   for this one host, which the policy already allows); otherwise it behaves as today.
3. Keep `box-ssh.1001ud.me` in the allowed hosts (that is what makes the direct TLS path
   resolvable). The "inject" setting becomes unnecessary but is harmless.

A new session picks the variables up. First test, read-only:

```bash
timeout 90 ssh -o BatchMode=yes box 'hostname; whoami; pwd; ls /home/o'
```

## If the token must not enter the sandbox

Then SSH from the cloud is not possible until the egress proxy relays WebSockets (a platform
limitation, not configurable per environment). The alternative that needs no new credential is
to move the files to a host the policy already allows: push a staging bundle (manifests, thumbnails
and the selected game-ready GLBs) from the box to a GitHub release or LFS branch of this
repository (GitHub hosts are reachable from the session), and retrieve it from there.
