# Deploy na VPS

Produção (VPS 177.7.52.155, Ubuntu 24.04 com CloudPanel):

| Parte | Endereço |
|---|---|
| Portal da terceirizada | https://protal.jotanunes.squad81.metapark.site |
| Área Jotanunes (Fluig) | https://fluig.jotanunes.squad81.metapark.site |
| API | https://api.jotanunes.squad81.metapark.site |

Instalação nativa, no mesmo padrão do fastgreen (nada do CloudPanel é alterado):

- API: serviço systemd `jotanunes-docs-api` (usuário `jotanunes-docs`), em `127.0.0.1:5080`, arquivos em `/opt/jotanunes-docs/api`.
- Configuração/segredos: `/etc/jotanunes-docs/api.env` (0600, root).
- Arquivos enviados: `/var/lib/jotanunes-docs/uploads`. Banco: PostgreSQL 16 local, base e usuário `jotanunes_docs`.
- Fronts: estáticos em `/opt/jotanunes-docs/{portal,fluig}` servidos pelo nginx (`/etc/nginx/sites-enabled/jotanunes-docs.conf`, HTTPS via Certbot).

## Publicar uma nova versão

```bash
./deploy/publicar.sh
```

Requer a chave `~/.ssh/jotanunes_deploy` autorizada na VPS, o `producao.env` (segredos de produção, fora do git) e o `.env` (Resend).
Os segredos do Fluig e do portal vêm **só** do `producao.env`.

## Operação

```bash
ssh -i ~/.ssh/jotanunes_deploy root@177.7.52.155
systemctl status jotanunes-docs-api
journalctl -u jotanunes-docs-api -n 100 --no-pager      # logs em JSON
```

Token Fluig de teste em produção (o Fluig real deve gerar com o mesmo segredo — ver `specs/.../contracts/fluig-identity.md`):

```bash
FLUIG_JWT_SECRET=$(grep ^FLUIG_JWT_SECRET= producao.env | cut -d= -f2-) node scripts/gerar-token-fluig-dev.mjs --admin
# abrir https://fluig.jotanunes.squad81.metapark.site/#fluigToken=<token>
```
