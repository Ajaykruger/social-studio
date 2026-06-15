#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-https://github.com/Ajaykruger/social-studio.git}"
TARGET_DOMAIN="${2:-studio.example.com}"
APP_USER="${APP_USER:-socialstudio}"
APP_DIR="${APP_DIR:-/opt/social-studio}"
SERVICE_NAME="${SERVICE_NAME:-social-studio}"
ENV_FILE="${APP_DIR}/.env"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root on the Ubuntu server."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

run_as_app_user() {
  runuser -u "${APP_USER}" -- "$@"
}

install_base_packages() {
  apt-get update
  apt-get install -y ca-certificates curl gnupg git sudo ufw
}

install_node_22() {
  if command -v node >/dev/null 2>&1 && node -v | grep -Eq '^v22\.'; then
    echo "Node 22 already installed: $(node -v)"
    return
  fi

  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

install_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    echo "Caddy already installed: $(caddy version)"
    return
  fi

  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  if [[ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]]; then
    curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  fi
  if [[ ! -f /etc/apt/sources.list.d/caddy-stable.list ]]; then
    curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" \
      | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  fi
  apt-get update
  apt-get install -y caddy
}

ensure_app_user() {
  if id -u "${APP_USER}" >/dev/null 2>&1; then
    echo "User ${APP_USER} already exists."
    return
  fi

  useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /bin/bash "${APP_USER}"
}

install_update_sudo_rule() {
  local sudoers_file="/etc/sudoers.d/${APP_USER}-${SERVICE_NAME}"
  cat >"${sudoers_file}" <<EOF
${APP_USER} ALL=(root) NOPASSWD: /bin/systemctl restart ${SERVICE_NAME}, /usr/bin/systemctl restart ${SERVICE_NAME}, /bin/systemctl status ${SERVICE_NAME}, /usr/bin/systemctl status ${SERVICE_NAME}
EOF
  chmod 0440 "${sudoers_file}"
}

clone_or_update_repo() {
  install -d -o "${APP_USER}" -g "${APP_USER}" "$(dirname "${APP_DIR}")"

  if [[ -d "${APP_DIR}/.git" ]]; then
    echo "Repository already exists. Pulling latest main."
    run_as_app_user git -C "${APP_DIR}" pull --ff-only
    return
  fi

  if [[ -e "${APP_DIR}" ]]; then
    echo "${APP_DIR} exists but is not a git checkout. Move it aside before running bootstrap."
    exit 1
  fi

  run_as_app_user git clone "${REPO_URL}" "${APP_DIR}"
}

build_app() {
  run_as_app_user npm --prefix "${APP_DIR}" ci
  run_as_app_user npm --prefix "${APP_DIR}" run build
}

install_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    cp "${APP_DIR}/deploy/.env.example" "${ENV_FILE}"
    echo "Created ${ENV_FILE} from deploy/.env.example. Edit it before real use."
  else
    echo "Keeping existing ${ENV_FILE}; bootstrap never overwrites it."
  fi

  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
}

install_service() {
  install -o root -g root -m 0644 \
    "${APP_DIR}/deploy/${SERVICE_NAME}.service" \
    "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}"
}

install_base_packages
install_node_22
install_caddy
ensure_app_user
install_update_sudo_rule
clone_or_update_repo
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
build_app
install_env_file
install_service

cat <<EOF

Bootstrap finished.

Next steps:
1. Edit ${ENV_FILE} on the server and keep it chmod 600.
2. Configure /etc/caddy/Caddyfile from ${APP_DIR}/deploy/Caddyfile for ${TARGET_DOMAIN}.
3. Put Cloudflare Access in front of ${TARGET_DOMAIN} before sending users there.
4. Check the app locally with: ${APP_DIR}/deploy/healthcheck.sh

The app remains draft-only. Caddy should proxy to 127.0.0.1:4810.
EOF
