#!/bin/bash
# Instalação/atualização do Portal de Documentos Jotanunes na VPS. Idempotente.
set -euo pipefail
P=protal.jotanunes.squad81.metapark.site; F=fluig.jotanunes.squad81.metapark.site; A=api.jotanunes.squad81.metapark.site
BASE=/opt/jotanunes-docs; DADOS=/var/lib/jotanunes-docs; CONF=/etc/jotanunes-docs; ORIGEM=/root/jotanunes-deploy

id jotanunes-docs >/dev/null 2>&1 || useradd --system --home-dir $DADOS --shell /usr/sbin/nologin jotanunes-docs
install -d -o jotanunes-docs -g jotanunes-docs -m 750 $DADOS $DADOS/uploads
install -d -m 755 $BASE; install -d -m 700 $CONF
install -m 600 $ORIGEM/api.env $CONF/api.env

# Banco (usuário e base próprios; senha vem do api.env)
SENHA_DB=$(grep '^ConnectionStrings__Default=' $CONF/api.env | sed -E 's/.*Password=([^;]*).*/\1/')
sudo -u postgres psql -qtAc "select 1 from pg_roles where rolname='jotanunes_docs'" | grep -q 1 \
  || sudo -u postgres psql -qc "create role jotanunes_docs login"
sudo -u postgres psql -qc "alter role jotanunes_docs with password '$SENHA_DB'" >/dev/null
sudo -u postgres psql -qtAc "select 1 from pg_database where datname='jotanunes_docs'" | grep -q 1 \
  || sudo -u postgres createdb -O jotanunes_docs jotanunes_docs
sudo -u postgres psql -qd jotanunes_docs -c "create extension if not exists unaccent" >/dev/null

# Aplicação (troca atômica das pastas)
for app in api portal fluig; do
  rm -rf $BASE/$app.novo; cp -a $ORIGEM/$app $BASE/$app.novo
  rm -rf $BASE/$app.antigo; [ -d $BASE/$app ] && mv $BASE/$app $BASE/$app.antigo; mv $BASE/$app.novo $BASE/$app
done
chown -R root:root $BASE; chmod -R a+rX $BASE

cat > /etc/systemd/system/jotanunes-docs-api.service <<UNIT
[Unit]
Description=Jotanunes - API do portal de documentos de terceirizadas
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=jotanunes-docs
Group=jotanunes-docs
WorkingDirectory=$BASE/api
EnvironmentFile=$CONF/api.env
ExecStart=/usr/bin/dotnet $BASE/api/Jotanunes.Docs.Api.dll
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DADOS

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q jotanunes-docs-api
systemctl restart jotanunes-docs-api

# nginx: 3 sites (HTTP). Só cria na primeira instalação; depois o Certbot acrescenta o HTTPS e o arquivo é preservado.
if [ ! -f /etc/nginx/sites-enabled/jotanunes-docs.conf ]; then
cat > /etc/nginx/sites-enabled/jotanunes-docs.conf <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name $A;
    client_max_body_size 11m;
    location / {
        proxy_pass http://127.0.0.1:5080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
server {
    listen 80;
    listen [::]:80;
    server_name $P;
    root $BASE/portal;
    index index.html;
    location /assets/ { expires 30d; add_header Cache-Control "public, immutable"; try_files \$uri =404; }
    location / { add_header Cache-Control "no-cache"; try_files \$uri /index.html; }
}
server {
    listen 80;
    listen [::]:80;
    server_name $F;
    root $BASE/fluig;
    index index.html;
    location /assets/ { expires 30d; add_header Cache-Control "public, immutable"; try_files \$uri =404; }
    location / { add_header Cache-Control "no-cache"; try_files \$uri /index.html; }
}
NGX
fi
nginx -t && systemctl reload nginx
echo "INSTALADO"
