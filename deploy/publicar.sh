#!/bin/bash
# Publica API + portal + fluig-app na VPS (177.7.52.155). Uso: ./deploy/publicar.sh
# Requer: chave ~/.ssh/jotanunes_deploy autorizada na VPS, producao.env (segredos de produção) e .env (Resend).
# Os segredos do Fluig/portal vêm SÓ do producao.env (nunca do .env de desenvolvimento).
set -euo pipefail
cd "$(dirname "$0")/.."
VPS=root@177.7.52.155
SSH=(-i "$HOME/.ssh/jotanunes_deploy" -o IdentitiesOnly=yes -o BatchMode=yes)
API=https://api.jotanunes.squad81.metapark.site
PORTAL=https://protal.jotanunes.squad81.metapark.site
FLUIG=https://fluig.jotanunes.squad81.metapark.site

val() { grep -E "^$2=" "$1" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
DB=$(val producao.env DB_SENHA); FS=$(val producao.env FLUIG_JWT_SECRET); PS=$(val producao.env AUTH_PORTAL_SECRET)
RK=$(val .env RESEND_API_KEY); RF=$(val .env RESEND_FROM)
for v in DB FS PS RK RF; do [ -n "${!v}" ] || { echo "Falta $v (producao.env/.env)"; exit 1; }; done

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
dotnet publish backend/src/Jotanunes.Docs.Api -c Release -o "$TMP/api" --nologo -v q
rm -f "$TMP/api/appsettings.Development.json"
(cd fluig-app && VITE_API_URL=$API VITE_USE_MOCKS=false npx vite build --outDir "$TMP/fluig" --emptyOutDir)
(cd portal && VITE_API_URL=$API VITE_USE_MOCKS=false npx vite build --outDir "$TMP/portal" --emptyOutDir)
rm -f "$TMP"/*/mockServiceWorker.js
cp deploy/instalar.sh "$TMP/"
cat > "$TMP/api.env" <<ENV
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5080
ConnectionStrings__Default=Host=127.0.0.1;Port=5432;Database=jotanunes_docs;Username=jotanunes_docs;Password=$DB
Auth__Fluig__Secret=$FS
Auth__Portal__Secret=$PS
Resend__ApiKey=$RK
Resend__From=$RF
Portal__BaseUrl=$PORTAL
Storage__Root=/var/lib/jotanunes-docs/uploads
Cors__Origins=$PORTAL,$FLUIG
Database__MigrateOnStartup=true
Catalogo__SemearTiposPadrao=true
ENV
chmod 600 "$TMP/api.env"
COPYFILE_DISABLE=1 tar czf "$TMP/pacote.tgz" --no-xattrs -C "$TMP" api portal fluig instalar.sh api.env 2>/dev/null \
  || COPYFILE_DISABLE=1 tar czf "$TMP/pacote.tgz" -C "$TMP" api portal fluig instalar.sh api.env
ssh "${SSH[@]}" $VPS 'rm -rf /root/jotanunes-deploy && install -d -m 700 /root/jotanunes-deploy'
scp -q "${SSH[@]}" "$TMP/pacote.tgz" $VPS:/root/jotanunes-deploy/pacote.tgz
ssh "${SSH[@]}" $VPS 'cd /root/jotanunes-deploy && tar xzf pacote.tgz 2>/dev/null && rm pacote.tgz && bash instalar.sh && rm -f api.env'
for i in $(seq 1 30); do curl -fsS "$API/health" >/dev/null 2>&1 && { echo "API no ar — publicado."; exit 0; }; sleep 2; done
echo "A API não respondeu em 60 s. Veja: ssh ... journalctl -u jotanunes-docs-api -n 50"; exit 1
