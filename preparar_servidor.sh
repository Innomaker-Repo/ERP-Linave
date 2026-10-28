#!/bin/bash
# Ajustes do sistema operacional do servidor que o Docker não consegue fazer sozinho.
# Rodar UMA vez, como root, no host:   sudo bash /opt/ERP-Linave/preparar_servidor.sh [tamanho_swap]
# Pode rodar de novo sem problema: cada passo verifica se já foi feito.
#
# Por quê (quedas de 23/10): o servidor foi desligado à força duas vezes, com indício de
# falta de memória depois que o tempo real acrescentou os containers ws (daphne) e redis.
#   1. swap: folga para picos de memória (build, relatório grande) antes de a máquina travar;
#   2. vm.swappiness=10: só usa o swap quando a RAM realmente acabar (evita lentidão);
#   3. vm.overcommit_memory=1: recomendado pelo Redis (aviso "Memory overcommit" no log).
set -Eeuo pipefail

TAMANHO_SWAP="${1:-2G}"
ARQUIVO_SWAP=/swapfile
SYSCTL_ERP=/etc/sysctl.d/99-erp-linave.conf

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo bash $0" >&2
  exit 1
fi

echo "== Memória antes =="
free -h

# 1. Swap — só cria se o servidor ainda não tiver nenhum.
if swapon --show --noheadings | grep -q .; then
  echo "== Swap já existe, mantido:"
  swapon --show
else
  echo "== Criando swap de ${TAMANHO_SWAP} em ${ARQUIVO_SWAP}"
  fallocate -l "${TAMANHO_SWAP}" "${ARQUIVO_SWAP}" || dd if=/dev/zero of="${ARQUIVO_SWAP}" bs=1M count="$(numfmt --from=iec "${TAMANHO_SWAP}" | awk '{print int($1/1048576)}')"
  chmod 600 "${ARQUIVO_SWAP}"
  mkswap "${ARQUIVO_SWAP}"
  swapon "${ARQUIVO_SWAP}"
  # Persistir no boot.
  grep -q "^${ARQUIVO_SWAP} " /etc/fstab || echo "${ARQUIVO_SWAP} none swap sw 0 0" >> /etc/fstab
fi

# 2 e 3. Parâmetros do kernel, persistidos em arquivo próprio (não mexe no sysctl.conf).
echo "== Gravando ${SYSCTL_ERP}"
cat > "${SYSCTL_ERP}" <<'EOF'
# ERP Linave — ver preparar_servidor.sh
vm.swappiness = 10
vm.overcommit_memory = 1
EOF
sysctl -p "${SYSCTL_ERP}"

echo "== Memória depois =="
free -h
echo
echo "== Uso atual de cada container (compare com MEM_LIMIT_* no docker-compose.yml/.env) =="
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null || echo "(docker indisponível)"
