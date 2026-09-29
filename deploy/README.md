# Deploy na VPS

Produção (VPS 177.7.52.155, Ubuntu 24.04 com CloudPanel):

| Parte | Endereço |
|---|---|
| Portal da terceirizada | https://protal.jotanunes.squad81.metapark.site |
| Área Jotanunes (Fluig ou login próprio) | https://fluig.jotanunes.squad81.metapark.site |
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
Os segredos do Fluig, do portal e do login próprio vêm **só** do `producao.env`; o script para com mensagem clara se
algum faltar (e se `AUTH_LOGIN_LOCAL_SECRET` tiver menos de 32 bytes ou for igual a um dos outros dois).

## Login próprio e primeiro administrador

A área Jotanunes também tem login próprio (login + senha de usuários internos, gerenciados na tela "Usuários" por
administradores). Configuração gerada pelo `publicar.sh` no `/etc/jotanunes-docs/api.env`:

| Variável da API | Origem |
|---|---|
| `Auth__LoginLocal__Secret` | `AUTH_LOGIN_LOCAL_SECRET` do `producao.env` (≥ 32 bytes, diferente de `FLUIG_JWT_SECRET` e `AUTH_PORTAL_SECRET`) |
| `Auth__LoginLocal__Habilitado` | `true` |
| `FluigApp__BaseUrl` | `https://fluig.jotanunes.squad81.metapark.site` — endereço que vai nos e-mails de acesso |

Variável nova no `producao.env` (uma vez, antes do primeiro deploy com o login próprio):

```bash
echo "AUTH_LOGIN_LOCAL_SECRET=$(openssl rand -base64 48)" >> producao.env
```

Trocar esse segredo derruba todas as sessões do login próprio (todos entram de novo) e zera os contadores de
tentativas de logins inexistentes; senhas e usuários não mudam.

Primeiro administrador (na VPS, depois do deploy; o `instalar.sh` lembra enquanto não houver nenhum e **nunca** roda
sozinho):

```bash
ssh -i ~/.ssh/jotanunes_deploy root@177.7.52.155
jotanunes-docs-criar-admin --login ana.souza --nome "Ana Souza" --email ana.souza@jotanunes.com
```

O atalho (`/usr/local/sbin/jotanunes-docs-criar-admin`, root, 0750) roda `dotnet Jotanunes.Docs.Api.dll criar-admin`
com o mesmo ambiente do serviço (`/etc/jotanunes-docs/api.env`, usuário `jotanunes-docs`, `/opt/jotanunes-docs/api`)
via `systemd-run --pipe --wait`, sem subir outro servidor web. A senha provisória (vale 7 dias, troca obrigatória no
primeiro acesso) aparece **só no terminal** — não vai para o journal — e também segue por e-mail para o endereço
informado. Códigos de saída: `0` pronto (mesmo se o e-mail falhar: aviso no terminal), `1` uso inválido ou login
próprio desligado, `2` já existe administrador ativo (nada mudou).

- **Recuperação** (todos os administradores perderam o acesso): o mesmo comando com `--forcar` cria o login informado
  ou, se ele já existe, torna-o administrador ativo com nova senha provisória (as sessões antigas dele caem).
- **Desligar o login próprio** (só entrada pelo Fluig): `Auth__LoginLocal__Habilitado=false` no
  `/etc/jotanunes-docs/api.env` e `systemctl restart jotanunes-docs-api`. A tela passa a mostrar "Abra este sistema pelo
  Fluig."; tokens do login próprio deixam de valer na hora. (O próximo `publicar.sh` volta a gravar `true`.)

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
