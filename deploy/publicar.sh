#!/bin/bash
# Publica API + portal + fluig-app na VPS (177.7.52.155). Uso: ./deploy/publicar.sh
# Requer: chave ~/.ssh/jotanunes_deploy autorizada na VPS, producao.env (segredos de produção) e .env (Resend).
# Os segredos do Fluig/portal/login próprio vêm SÓ do producao.env (nunca do .env de desenvolvimento).
set -euo pipefail
cd "$(dirname "$0")/.."
VPS=root@177.7.52.155
SSH=(-i "$HOME/.ssh/jotanunes_deploy" -o IdentitiesOnly=yes -o BatchMode=yes)
API=https://api.jotanunes.squad81.metapark.site
PORTAL=https://protal.jotanunes.squad81.metapark.site
FLUIG=https://fluig.jotanunes.squad81.metapark.site

val() { grep -E "^$2=" "$1" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
DB=$(val producao.env DB_SENHA); FS=$(val producao.env FLUIG_JWT_SECRET); PS=$(val producao.env AUTH_PORTAL_SECRET)
LS=$(val producao.env AUTH_LOGIN_LOCAL_SECRET)
RK=$(val .env RESEND_API_KEY); RF=$(val .env RESEND_FROM)
for v in DB FS PS RK RF; do [ -n "${!v}" ] || { echo "Falta $v (producao.env/.env)"; exit 1; }; done
# Login próprio da área Jotanunes: segredo próprio, só do producao.env, >= 32 bytes e diferente dos outros dois.
[ -n "$LS" ] || { echo "Falta AUTH_LOGIN_LOCAL_SECRET no producao.env (gere com: openssl rand -base64 48)"; exit 1; }
[ "$(printf %s "$LS" | wc -c)" -ge 32 ] || { echo "AUTH_LOGIN_LOCAL_SECRET no producao.env precisa de pelo menos 32 bytes"; exit 1; }
[ "$LS" != "$FS" ] && [ "$LS" != "$PS" ] || { echo "AUTH_LOGIN_LOCAL_SECRET precisa ser diferente de FLUIG_JWT_SECRET e AUTH_PORTAL_SECRET"; exit 1; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
dotnet publish backend/src/Jotanunes.Docs.Api -c Release -o "$TMP/api" --nologo -v q
rm -f "$TMP/api/appsettings.Development.json"
(cd fluig-app && VITE_API_URL=$API VITE_USE_MOCKS=false npx vite build --outDir "$TMP/fluig" --emptyOutDir)
(cd portal && VITE_API_URL=$API VITE_USE_MOCKS=false npx vite build --outDir "$TMP/portal" --emptyOutDir)
rm -f "$TMP"/*/mockServiceWorker.js
cp deploy/instalar.sh deploy/criar-admin.sh "$TMP/"
cat > "$TMP/api.env" <<ENV
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5080
ConnectionStrings__Default=Host=127.0.0.1;Port=5432;Database=jotanunes_docs;Username=jotanunes_docs;Password=$DB
Auth__Fluig__Secret=$FS
Auth__Portal__Secret=$PS
Auth__LoginLocal__Habilitado=true
Auth__LoginLocal__Secret=$LS
FluigApp__BaseUrl=$FLUIG
Resend__ApiKey=$RK
Resend__From=$RF
Portal__BaseUrl=$PORTAL
Storage__Root=/var/lib/jotanunes-docs/uploads
Cors__Origins=$PORTAL,$FLUIG
Database__MigrateOnStartup=true
Catalogo__SemearTiposPadrao=true
ENV
chmod 600 "$TMP/api.env"
COPYFILE_DISABLE=1 tar czf "$TMP/pacote.tgz" --no-xattrs -C "$TMP" api portal fluig instalar.sh criar-admin.sh api.env 2>/dev/null \
  || COPYFILE_DISABLE=1 tar czf "$TMP/pacote.tgz" -C "$TMP" api portal fluig instalar.sh criar-admin.sh api.env
ssh "${SSH[@]}" $VPS 'rm -rf /root/jotanunes-deploy && install -d -m 700 /root/jotanunes-deploy'
scp -q "${SSH[@]}" "$TMP/pacote.tgz" $VPS:/root/jotanunes-deploy/pacote.tgz
ssh "${SSH[@]}" $VPS 'cd /root/jotanunes-deploy && tar xzf pacote.tgz 2>/dev/null && rm pacote.tgz && bash instalar.sh && rm -f api.env'
for i in $(seq 1 30); do curl -fsS "$API/health" >/dev/null 2>&1 && { echo "API no ar — publicado."; exit 0; }; sleep 2; done
echo "A API não respondeu em 60 s. Veja: ssh ... journalctl -u jotanunes-docs-api -n 50"; exit 1
