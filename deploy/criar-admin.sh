#!/bin/bash
# jotanunes-docs-criar-admin — cria (ou recupera, com --forcar) o primeiro administrador do login próprio da área
# Jotanunes na VPS. Instalado pelo deploy/instalar.sh em /usr/local/sbin/jotanunes-docs-criar-admin (root, 0750).
#
# Uso: jotanunes-docs-criar-admin --login <login> --nome "<nome>" --email <email> [--forcar]
#
# Roda `dotnet Jotanunes.Docs.Api.dll criar-admin ...` com o MESMO ambiente do serviço jotanunes-docs-api
# (EnvironmentFile=/etc/jotanunes-docs/api.env, usuário/grupo jotanunes-docs, WorkingDirectory da API), sem subir o
# servidor web. `systemd-run --pipe` liga a entrada/saída do comando a ESTE terminal: a senha provisória aparece só
# aqui e não vai para o journal. `--wait` devolve o código de saída do comando (0 pronto, 1 uso inválido ou login
# próprio desligado, 2 já existe administrador).
set -uo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo jotanunes-docs-criar-admin --login <login> --nome \"<nome>\" --email <email>" >&2
  exit 1
fi
if [ ! -f /etc/jotanunes-docs/api.env ] || [ ! -f /opt/jotanunes-docs/api/Jotanunes.Docs.Api.dll ]; then
  echo "API não instalada (faltam /etc/jotanunes-docs/api.env ou /opt/jotanunes-docs/api). Rode o deploy primeiro." >&2
  exit 1
fi

exec systemd-run --quiet --pipe --wait --collect \
  -p EnvironmentFile=/etc/jotanunes-docs/api.env \
  -p User=jotanunes-docs -p Group=jotanunes-docs \
  -p WorkingDirectory=/opt/jotanunes-docs/api \
  /usr/bin/dotnet /opt/jotanunes-docs/api/Jotanunes.Docs.Api.dll criar-admin "$@"
