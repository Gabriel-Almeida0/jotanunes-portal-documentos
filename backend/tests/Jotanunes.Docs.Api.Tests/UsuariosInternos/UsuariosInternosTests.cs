using Jotanunes.Docs.Domain.UsuariosInternos;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.UsuariosInternos;

/// <summary>
/// Gestão de usuários internos pela tela "Usuários" (US9/AC1–AC12; FR-102, FR-108–FR-110, FR-112, FR-113): cadastro com
/// e-mail de acesso, lista, edição, regra do último administrador, redefinição de senha e auditoria.
/// </summary>
public class UsuariosInternosTests(ApiFactory api) : TesteApi(api)
{
    private HttpClient AdminFluig() => Fluig("ana.admin", "Ana Admin");

    private static object Novo(string login = "Bia.Nova", string nome = "Bia Nova", string email = "bia.nova@jotanunes.com", bool admin = false) =>
        new { login, nome, email, admin };

    private static object Atualizacao(UsuarioInterno u, bool admin, bool ativo, string? nome = null, string? email = null) =>
        new { nome = nome ?? u.Nome, email = email ?? u.Email, admin, ativo };

    [Fact]
    public async Task Criar_grava_em_minusculas_envia_email_e_nunca_devolve_a_senha()
    {
        var admin = await Semente.UsuarioInternoAsync("lucas.admin", admin: true);
        var r = await Local(admin).PostAsJsonAsync("/api/fluig/usuarios", Novo());
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal($"/api/fluig/usuarios/{j.Id()}", r.Headers.Location?.ToString());
        Assert.Equal("bia.nova", j.Str("login"));
        Assert.Equal("AGUARDANDO_PRIMEIRO_ACESSO", j.Str("situacao"));
        Assert.Equal("lucas.admin", j.Str("criadoPor"));
        Assert.False(j.GetProperty("admin").GetBoolean());
        Assert.True(j.GetProperty("ativo").GetBoolean());
        Assert.Equal(Api.Relogio.GetUtcNow().AddDays(7), j.GetProperty("senhaProvisoriaExpiraEm").GetDateTimeOffset(), TimeSpan.FromSeconds(5));

        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Equal("bia.nova@jotanunes.com", email.Para);
        Assert.Equal("Jotanunes: seu acesso ao sistema de documentação de terceirizadas", email.Assunto);
        var senha = FluxoLoginLocal.SenhaDoEmail(email);
        Assert.Equal(12, senha.Length);
        Assert.Equal("bia.nova", FluxoLoginLocal.LoginDoEmail(email));
        Assert.Contains(ApiFactory.FluigAppBaseUrl, email.Texto);
        Assert.Contains(ApiFactory.FluigAppBaseUrl, email.Html);
        Assert.Contains("7 dias", email.Texto);
        Assert.Contains("cid:logo-jotanunes", email.Html);

        Assert.DoesNotContain(senha, await r.Content.ReadAsStringAsync());
        var banco = await Api.NoBancoAsync(db => db.UsuariosInternos.AsNoTracking().SingleAsync(u => u.Login == "bia.nova"));
        Assert.StartsWith("$2", banco.SenhaHash);
        Assert.Equal("12", BCrypt.Net.BCrypt.InterrogateHash(banco.SenhaHash).WorkFactor);
        Assert.True(BCrypt.Net.BCrypt.Verify(senha, banco.SenhaHash));
        var linhas = await Api.NoBancoAsync(db =>
            db.Database.SqlQueryRaw<string>("SELECT row_to_json(u)::text AS \"Value\" FROM usuarios_internos u").ToListAsync());
        Assert.All(linhas, l => Assert.DoesNotContain(senha, l));

        // A senha do e-mail entra (com troca obrigatória).
        var login = await (await FluxoLoginLocal.LoginAsync(Api, "BIA.NOVA", senha)).LerAsync();
        Assert.True(login.GetProperty("usuario").GetProperty("trocaSenhaObrigatoria").GetBoolean());
        Assert.DoesNotContain(senha, string.Join("\n", Api.Logs.Linhas));
    }

    [Fact]
    public async Task Login_repetido_com_outra_caixa_409_LOGIN_DUPLICADO()
    {
        await Semente.UsuarioInternoAsync("bia.nova");
        var r = await AdminFluig().PostAsJsonAsync("/api/fluig/usuarios", Novo(login: "BIA.Nova"));
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("LOGIN_DUPLICADO", await r.CodigoAsync());
        Assert.Empty(Api.Emails.Mensagens);
    }

    [Fact]
    public async Task Validacao_por_campo()
    {
        var r = await AdminFluig().PostAsJsonAsync("/api/fluig/usuarios", new { login = "jo ão", nome = "A", email = "sem-arroba" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
        var erros = (await r.LerAsync()).GetProperty("errors");
        foreach (var campo in new[] { "login", "nome", "email" }) Assert.True(erros.TryGetProperty(campo, out _), campo);

        var put = await AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{(await Semente.UsuarioInternoAsync()).Id}", new { nome = "Nome Ok", email = "a@b.com" });
        Assert.Equal("VALIDACAO", await put.CodigoAsync());
    }

    [Fact]
    public async Task Email_falhando_502_e_nada_gravado()
    {
        Api.Emails.Falhar = true;
        var r = await AdminFluig().PostAsJsonAsync("/api/fluig/usuarios", Novo());
        Assert.Equal((HttpStatusCode)502, r.StatusCode);
        Assert.Equal("EMAIL_ACESSO_FALHOU", await r.CodigoAsync());
        Assert.Equal(0, await Api.NoBancoAsync(db => db.UsuariosInternos.CountAsync()));
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "USUARIO_CRIADO")));
    }

    [Fact]
    public async Task Lista_ordenada_por_nome_com_filtros_e_paginacao()
    {
        await Semente.UsuarioInternoAsync("zeca", "Zeca Último", "zeca@jotanunes.com");
        await Semente.UsuarioInternoAsync("alvaro", "Álvaro Primeiro", "alvaro@obra.com", admin: true);
        await Semente.UsuarioInternoAsync("marta", "Marta Meio", "marta@jotanunes.com", ativo: false);

        var todos = await (await AdminFluig().GetAsync("/api/fluig/usuarios")).LerAsync();
        Assert.Equal(3, todos.GetProperty("total").GetInt32());
        Assert.Equal(["Álvaro Primeiro", "Marta Meio", "Zeca Último"], todos.GetProperty("itens").EnumerateArray().Select(i => i.Str("nome")));
        Assert.Equal(1, todos.GetProperty("pagina").GetInt32());
        Assert.Equal(20, todos.GetProperty("tamanhoPagina").GetInt32());

        async Task<string[]> Logins(string query) =>
            (await (await AdminFluig().GetAsync("/api/fluig/usuarios?" + query)).LerAsync()).GetProperty("itens").EnumerateArray().Select(i => i.Str("login")).ToArray();
        Assert.Equal(["alvaro"], await Logins("busca=alvaro"));   // nome sem acento
        Assert.Equal(["alvaro"], await Logins("busca=OBRA.COM")); // e-mail
        Assert.Equal(["zeca"], await Logins("busca=zec"));        // login
        Assert.Equal(["marta"], await Logins("ativo=false"));
        Assert.Equal(["alvaro", "zeca"], await Logins("ativo=true"));
        Assert.Equal(["alvaro"], await Logins("admin=true"));
        Assert.Equal(["marta", "zeca"], await Logins("admin=false"));
        Assert.Equal(["marta"], await Logins("pagina=2&tamanhoPagina=1"));
        Assert.Equal("VALIDACAO", await (await AdminFluig().GetAsync("/api/fluig/usuarios?tamanhoPagina=101")).CodigoAsync());
    }

    [Fact]
    public async Task Obter_200_e_404()
    {
        var u = await Semente.UsuarioInternoAsync("gil.obter", "Gil Obter");
        var ok = await AdminFluig().GetAsync($"/api/fluig/usuarios/{u.Id}");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var j = await ok.LerAsync();
        Assert.Equal("gil.obter", j.Str("login"));
        Assert.Equal("ATIVO", j.Str("situacao"));
        Assert.Equal("semente", j.Str("criadoPor"));
        Assert.Equal(JsonValueKind.Null, j.GetProperty("bloqueadoAte").ValueKind);

        var nf = await AdminFluig().GetAsync($"/api/fluig/usuarios/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, nf.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await nf.CodigoAsync());
    }

    [Fact]
    public async Task Bloqueado_aparece_com_bloqueadoAte()
    {
        var u = await Semente.UsuarioInternoAsync("bloq.usuario");
        for (var i = 0; i < 5; i++) await FluxoLoginLocal.LoginAsync(Api, "bloq.usuario", "SenhaErrada99");
        var j = await (await AdminFluig().GetAsync($"/api/fluig/usuarios/{u.Id}")).LerAsync();
        Assert.NotEqual(JsonValueKind.Null, j.GetProperty("bloqueadoAte").ValueKind);
        Assert.Equal("ATIVO", j.Str("situacao"));
    }

    [Fact]
    public async Task Atualizar_nome_e_email()
    {
        var u = await Semente.UsuarioInternoAsync("hugo.edit", "Hugo Edit");
        var r = await AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{u.Id}", Atualizacao(u, false, true, "Hugo Editado", "Hugo@Novo.com"));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("Hugo Editado", j.Str("nome"));
        Assert.Equal("hugo@novo.com", j.Str("email"));
        Assert.Equal("hugo.edit", j.Str("login"));
        var linha = await AuditoriaTeste.UnicaAsync(Api, "USUARIO_ATUALIZADO");
        Assert.Equal(("FLUIG", "ana.admin", true, "USUARIO_INTERNO", u.Id.ToString()),
            (linha.AtorTipo, linha.AtorId, linha.AtorAdmin ?? false, linha.RecursoTipo, linha.RecursoId));
    }

    [Fact]
    public async Task Sessao_local_nao_desativa_a_si_mesma_nem_tira_o_proprio_papel()
    {
        await Semente.UsuarioInternoAsync("outro.admin", admin: true);
        var eu = await Semente.UsuarioInternoAsync("eu.admin", "Eu Admin", admin: true);
        foreach (var (adminNovo, ativo) in new[] { (true, false), (false, true), (false, false) })
        {
            var r = await Local(eu).PutAsJsonAsync($"/api/fluig/usuarios/{eu.Id}", Atualizacao(eu, adminNovo, ativo));
            Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
            Assert.Equal("ALTERACAO_PROPRIA_NAO_PERMITIDA", await r.CodigoAsync());
        }
        var depois = await Semente.RecarregarUsuarioAsync(eu.Id);
        Assert.True(depois.Admin && depois.Ativo);
        Assert.Equal(eu.VersaoCredencial, depois.VersaoCredencial);
        // Mudar o próprio nome pode.
        Assert.Equal(HttpStatusCode.OK, (await Local(eu).PutAsJsonAsync($"/api/fluig/usuarios/{eu.Id}", Atualizacao(eu, true, true, "Eu Mesmo"))).StatusCode);
    }

    [Fact]
    public async Task Fluig_admin_nao_tira_o_papel_nem_desativa_o_unico_admin_interno()
    {
        var unico = await Semente.UsuarioInternoAsync("unico.admin", admin: true);
        await Semente.UsuarioInternoAsync("admin.inativo", admin: true, ativo: false); // não conta
        foreach (var (adminNovo, ativo) in new[] { (false, true), (true, false) })
        {
            var r = await AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{unico.Id}", Atualizacao(unico, adminNovo, ativo));
            Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
            Assert.Equal("ULTIMO_ADMINISTRADOR", await r.CodigoAsync());
            Assert.Equal("O sistema precisa de pelo menos um administrador ativo.", (await r.LerAsync()).Str("title"));
        }
        Assert.True((await Semente.RecarregarUsuarioAsync(unico.Id)).EhAdministradorAtivo);
    }

    [Fact]
    public async Task Com_dois_admins_tirar_um_funciona()
    {
        var a = await Semente.UsuarioInternoAsync("admin.a", admin: true);
        await Semente.UsuarioInternoAsync("admin.b", admin: true);
        var r = await AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{a.Id}", Atualizacao(a, false, true));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.False((await r.LerAsync()).GetProperty("admin").GetBoolean());
    }

    [Fact]
    public async Task Duas_desativacoes_simultaneas_nao_zeram_os_administradores()
    {
        var a = await Semente.UsuarioInternoAsync("admin.a", admin: true);
        var b = await Semente.UsuarioInternoAsync("admin.b", admin: true);
        var respostas = await Task.WhenAll(
            AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{a.Id}", Atualizacao(a, true, false)),
            AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{b.Id}", Atualizacao(b, true, false)));
        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.OK);
        var conflito = Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal("ULTIMO_ADMINISTRADOR", await conflito.CodigoAsync());
        Assert.Equal(1, await Api.NoBancoAsync(db => db.UsuariosInternos.CountAsync(u => u.Admin && u.Ativo)));
    }

    [Fact]
    public async Task Desativar_e_reativar_auditados()
    {
        var u = await Semente.UsuarioInternoAsync("ivo.comum");
        Assert.Equal(HttpStatusCode.OK, (await AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{u.Id}", Atualizacao(u, false, false))).StatusCode);
        var desativado = await (await AdminFluig().GetAsync($"/api/fluig/usuarios/{u.Id}")).LerAsync();
        Assert.Equal("DESATIVADO", desativado.Str("situacao"));
        Assert.Equal(HttpStatusCode.OK, (await AdminFluig().PutAsJsonAsync($"/api/fluig/usuarios/{u.Id}", Atualizacao(u, false, true))).StatusCode);

        Assert.Equal("USUARIO_INTERNO", (await AuditoriaTeste.UnicaAsync(Api, "USUARIO_DESATIVADO")).RecursoTipo);
        Assert.Equal("USUARIO_INTERNO", (await AuditoriaTeste.UnicaAsync(Api, "USUARIO_REATIVADO")).RecursoTipo);
        Assert.Empty(await AuditoriaTeste.LinhasAsync(Api, "USUARIO_ATUALIZADO"));
    }

    [Fact]
    public async Task Redefinir_senha_envia_nova_provisoria_desbloqueia_e_recusa_a_antiga()
    {
        var admin = await Semente.UsuarioInternoAsync("lucas.admin", admin: true);
        var u = await Semente.UsuarioInternoAsync("rosa.redef", "Rosa Redef", "rosa@jotanunes.com");
        for (var i = 0; i < 5; i++) await FluxoLoginLocal.LoginAsync(Api, "rosa.redef", "SenhaErrada99");

        var r = await Local(admin).PostAsync($"/api/fluig/usuarios/{u.Id}/redefinir-senha", null);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("AGUARDANDO_PRIMEIRO_ACESSO", j.Str("situacao"));
        Assert.Equal(JsonValueKind.Null, j.GetProperty("bloqueadoAte").ValueKind);

        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Equal("rosa@jotanunes.com", email.Para);
        Assert.Equal("Jotanunes: sua nova senha provisória", email.Assunto);
        var senha = FluxoLoginLocal.SenhaDoEmail(email);
        Assert.DoesNotContain(senha, await r.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await FluxoLoginLocal.LoginAsync(Api, "rosa.redef", Semente.SenhaPadrao)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await FluxoLoginLocal.LoginAsync(Api, "rosa.redef", senha)).StatusCode);

        var linha = await AuditoriaTeste.UnicaAsync(Api, "SENHA_REDEFINIDA");
        Assert.Equal(("LOCAL", "lucas.admin", true, u.Id.ToString()), (linha.AtorTipo, linha.AtorId, linha.AtorAdmin ?? false, linha.RecursoId));
        Assert.DoesNotContain(senha, string.Join("\n", Api.Logs.Linhas));
    }

    [Fact]
    public async Task Redefinir_senha_de_inativo_409_e_inexistente_404()
    {
        var u = await Semente.UsuarioInternoAsync("ina.tivo", ativo: false);
        var r = await AdminFluig().PostAsync($"/api/fluig/usuarios/{u.Id}/redefinir-senha", null);
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("USUARIO_INATIVO", await r.CodigoAsync());
        Assert.Empty(Api.Emails.Mensagens);
        Assert.Equal(HttpStatusCode.NotFound, (await AdminFluig().PostAsync($"/api/fluig/usuarios/{Guid.NewGuid()}/redefinir-senha", null)).StatusCode);
    }

    [Fact]
    public async Task Redefinir_com_email_falhando_502_e_a_senha_antiga_continua_valendo()
    {
        var u = await Semente.UsuarioInternoAsync("fabio.falha");
        Api.Emails.Falhar = true;
        var r = await AdminFluig().PostAsync($"/api/fluig/usuarios/{u.Id}/redefinir-senha", null);
        Assert.Equal((HttpStatusCode)502, r.StatusCode);
        Assert.Equal("EMAIL_ACESSO_FALHOU", await r.CodigoAsync());
        Api.Emails.Falhar = false;
        Assert.Equal(HttpStatusCode.OK, (await FluxoLoginLocal.LoginAsync(Api, "fabio.falha", Semente.SenhaPadrao)).StatusCode);
        Assert.Equal(u.VersaoCredencial, (await Semente.RecarregarUsuarioAsync(u.Id)).VersaoCredencial);
        Assert.Empty(await AuditoriaTeste.LinhasAsync(Api, "SENHA_REDEFINIDA"));
    }

    [Fact]
    public async Task Auditoria_do_cadastro_com_token_fluig_e_local()
    {
        var admin = await Semente.UsuarioInternoAsync("lucas.admin", admin: true);
        Assert.Equal(HttpStatusCode.Created, (await AdminFluig().PostAsJsonAsync("/api/fluig/usuarios", Novo("pelo.fluig"))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Local(admin).PostAsJsonAsync("/api/fluig/usuarios", Novo("pelo.local"))).StatusCode);

        var linhas = await AuditoriaTeste.LinhasAsync(Api, "USUARIO_CRIADO");
        Assert.Equal([("FLUIG", "ana.admin"), ("LOCAL", "lucas.admin")], linhas.Select(l => (l.AtorTipo, l.AtorId!)));
        Assert.All(linhas, l => Assert.True(l.AtorAdmin));
        Assert.All(linhas, l => Assert.Equal("USUARIO_INTERNO", l.RecursoTipo));
        var senhas = Api.Emails.Mensagens.Select(FluxoLoginLocal.SenhaDoEmail).ToList();
        await AuditoriaTeste.SemSegredosAsync(Api, senhas);
        var logs = string.Join("\n", Api.Logs.Linhas);
        Assert.All(senhas, s => Assert.DoesNotContain(s, logs));
    }
}
