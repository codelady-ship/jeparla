#!/usr/bin/env bash
# First-time setup of the Jeparla VM (Oracle Cloud Always Free, Ampere A1, arm64). Run once, as the default
# user (ubuntu or opc), with sudo rights:
#
#   curl -fsSL https://raw.githubusercontent.com/codelady-ship/jeparla/main/deploy/scripts/setup-vm.sh -o setup-vm.sh
#   less setup-vm.sh          # read it first
#   bash setup-vm.sh
#
# What it does (idempotent, safe to run again):
#   1. installs Docker Engine + the compose plugin (Ubuntu 22.04/24.04 or Oracle Linux 8/9), git, gnupg, awscli
#   2. opens ports 80 and 443 in the VM's own firewall (Oracle images ship with iptables/firewalld rules that
#      block everything but SSH; the OCI security list is opened separately in the console, docs/deploy.md)
#   3. turns off SSH password login (keys only)
#   4. adds a 4 GB swap file (the Gradle build of the API image peaks above 2 GB)
#   5. clones the repository to /opt/jeparla
# It never asks for or stores a secret.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/codelady-ship/jeparla.git}"
APP_DIR="${APP_DIR:-/opt/jeparla}"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-4}"

if [ "$(uname -m)" != "aarch64" ]; then
  echo "warning: expected an arm64 (aarch64) VM, got $(uname -m); continuing" >&2
fi

. /etc/os-release
echo "== OS: $PRETTY_NAME"

# ---- 1. Packages and Docker ----------------------------------------------------------
case "$ID" in
  ubuntu)
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl git gnupg netfilter-persistent iptables-persistent unzip
    if ! command -v docker >/dev/null 2>&1; then
      sudo install -m 0755 -d /etc/apt/keyrings
      sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
      sudo chmod a+r /etc/apt/keyrings/docker.asc
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
      sudo apt-get update -y
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
    ;;
  ol|rhel|centos|rocky|almalinux)
    sudo dnf install -y dnf-plugins-core git gnupg2 curl unzip
    if ! command -v docker >/dev/null 2>&1; then
      sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
      sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
    ;;
  *)
    echo "unsupported OS: $ID (use Ubuntu 24.04 or Oracle Linux 9)" >&2
    exit 1
    ;;
esac

# AWS CLI v2 (backups to R2 or Oracle Object Storage, docker/backup/pg-backup.sh).
if ! command -v aws >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "$tmp/awscliv2.zip"
  unzip -q "$tmp/awscliv2.zip" -d "$tmp"
  sudo "$tmp/aws/install" --update
  rm -rf "$tmp"
fi

sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

# ---- 2. Firewall: 80 and 443 -----------------------------------------------------------
if command -v firewall-cmd >/dev/null 2>&1 && sudo systemctl is-active --quiet firewalld; then
  sudo firewall-cmd --permanent --add-service=http --add-service=https
  sudo firewall-cmd --permanent --add-port=443/udp
  sudo firewall-cmd --reload
else
  # Oracle's Ubuntu image: INPUT ends with a REJECT rule, so ACCEPT must come before it. Oracle advises
  # against ufw on these images (it rewrites the rules the instance needs for its block volumes).
  allow() {
    if sudo iptables -C INPUT "$@" -j ACCEPT 2>/dev/null; then
      return
    fi
    # Position of the first REJECT rule; without one, append.
    pos="$(sudo iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }')"
    if [ -n "$pos" ]; then
      sudo iptables -I INPUT "$pos" "$@" -j ACCEPT
    else
      sudo iptables -A INPUT "$@" -j ACCEPT
    fi
  }
  allow -p tcp -m state --state NEW --dport 80
  allow -p tcp -m state --state NEW --dport 443
  allow -p udp --dport 443
  sudo netfilter-persistent save
fi

# ---- 3. SSH: keys only -------------------------------------------------------------------
if [ -d /etc/ssh/sshd_config.d ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
    | sudo tee /etc/ssh/sshd_config.d/60-jeparla.conf >/dev/null
  sudo systemctl reload ssh 2>/dev/null || sudo systemctl reload sshd
fi

# ---- 4. Swap ---------------------------------------------------------------------------------
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l "${SWAP_SIZE_GB}G" /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# ---- 5. Repository -----------------------------------------------------------------------------
if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER":"$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

echo
echo "== Done. Next steps (docs/deploy.md, step 6):"
echo "   1. log out and back in (docker group), then:  cd $APP_DIR"
echo "   2. cp deploy/.env.example deploy/.env && chmod 600 deploy/.env && nano deploy/.env"
echo "   3. deploy/scripts/deploy.sh"
