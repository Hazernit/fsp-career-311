#!/bin/bash
set -euo pipefail
umask 077

# Run only on the separate FSP VM. Do not run this bootstrap on another project's host.
config_file=${1:-/root/fsp-bootstrap.env}
test "$(id -u)" = 0
test -f "$config_file"
set -a
. "$config_file"
set +a
[[ ${FSP_SOURCE_COMMIT:-} =~ ^[a-f0-9]{40}$ ]]
[[ ${FSP_GATEWAY_TOKEN:-} =~ ^[a-f0-9]{64}$ ]]
[[ ${FSP_PUBLIC_ORIGIN:-} =~ ^https://[a-zA-Z0-9.-]+\.apigw\.yandexcloud\.net$ ]]
test ! -e /opt/fsp-career
. /etc/os-release
test "$ID" = ubuntu
test "$VERSION_ID" = 24.04

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git docker.io docker-compose-v2
systemctl enable --now docker
git clone --no-checkout https://github.com/Hazernit/fsp-career-311.git /opt/fsp-career
git -C /opt/fsp-career checkout --detach "$FSP_SOURCE_COMMIT"
test -f /opt/fsp-career/deploy/compose.yandex.yaml

FSP_PRIVATE_IP=$(ip -4 route get 169.254.169.254 | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n 1)
[[ $FSP_PRIVATE_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
install -d -m 0700 /etc/fsp-career
cat > /etc/fsp-career/runtime.env <<EOF
FSP_PRIVATE_IP=$FSP_PRIVATE_IP
FSP_PUBLIC_ORIGIN=$FSP_PUBLIC_ORIGIN
FSP_GATEWAY_TOKEN=$FSP_GATEWAY_TOKEN
FSP_DATA_VOLUME=fsp-career-cloud-data
FSP_IMAGE=fsp-career:cloud
EOF
chmod 0600 /etc/fsp-career/runtime.env
docker volume create fsp-career-cloud-data > /dev/null
cd /opt/fsp-career
docker compose --env-file /etc/fsp-career/runtime.env -f deploy/compose.yandex.yaml config --quiet
docker compose --env-file /etc/fsp-career/runtime.env -f deploy/compose.yandex.yaml up --build -d --wait --wait-timeout 300
install -d -m 0755 /var/lib/fsp-career
printf 'commit=%s\norigin=%s\nprivate_ip=%s\n' "$FSP_SOURCE_COMMIT" "$FSP_PUBLIC_ORIGIN" "$FSP_PRIVATE_IP" > /var/lib/fsp-career/deployment-ready.txt
printf 'FSP_DEPLOYMENT_READY %s %s\n' "$FSP_SOURCE_COMMIT" "$FSP_PUBLIC_ORIGIN"
