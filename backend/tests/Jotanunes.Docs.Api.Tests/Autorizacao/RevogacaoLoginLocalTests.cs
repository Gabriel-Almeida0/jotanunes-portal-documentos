using Jotanunes.Docs.Domain.UsuariosInternos;

namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>
/// Revogação imediata do token do login próprio (FR-106, SC-013, constituição III v1.2.0): desativar, mudar o papel,
/// redefinir/trocar a senha e sair derrubam o token na próxima requisição; mudar só nome/e-mail não.
/// </summary>
public class RevogacaoLoginLocalTests(ApiFactory api) : TesteApi(api)
{
    private HttpClient AdminFluig() => Fluig("ana.admin", "Ana Admin");

    private async Task<(UsuarioInterno Usuario, string Token)> ComumLogadoAsync(bool admin = false)
    {
        var u = await Semente.UsuarioInternoAsync("carla.alvo", "Carla Alvo", "carla@jotanunes.com", admin: admin);
        var token = await FluxoLoginLocal.EntrarAsync(Api, "carla.alvo");
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: token).GetAsync("/api/fluig/painel")).StatusCode);
        return (u, token);
    }

    private async Task AssertRevogadoAsync(string token)
    {
        var r = await Api.Cliente(token: token).GetAsync("/api/fluig/painel");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        Assert.Equal("NAO_AUTENTICADO", await r.CodigoAsync());
    }

    private Task<HttpResponseMessage> AtualizarAsync(HttpClient admin, UsuarioInterno u, bool adminNovo, bool ativo, string? nome = null,
        string? email = null) =>
        admin.PutAsJsonAsync($"/api/fluig/usuarios/{u.Id}", new { nome = nome ?? u.Nome, email = email ?? u.Email, admin = adminNovo, ativo });

    [Fact]
    public async Task Desativar_revoga()
    {
        var (u, token) = await ComumLogadoAsync();
        Assert.Equal(HttpStatusCode.OK, (await AtualizarAsync(AdminFluig(), u, false, ativo: false)).StatusCode);
        await AssertRevogadoAsync(token);
    }

    [Fact]
    public async Task Dar_o_papel_de_administrador_revoga_e_o_novo_login_traz_roles_admin()
    {
        var (u, token) = await ComumLogadoAsync();
        Assert.Equal(HttpStatusCode.OK, (await AtualizarAsync(AdminFluig(), u, true, ativo: true)).StatusCode);
        await AssertRevogadoAsync(token);
        var novo = FluxoLoginLocal.Payload(await FluxoLoginLocal.EntrarAsync(Api, "carla.alvo"));
        Assert.Equal(["admin"], novo.GetProperty("roles").EnumerateArray().Select(e => e.GetString()!));
    }

    [Fact]
    public async Task Tirar_o_papel_de_administrador_revoga_e_o_novo_login_vem_sem_roles()
    {
        await Semente.UsuarioInternoAsync("outro.admin", admin: true); // não é o último administrador
        var (u, token) = await ComumLogadoAsync(admin: true);
        Assert.Equal(HttpStatusCode.OK, (await AtualizarAsync(AdminFluig(), u, false, ativo: true)).StatusCode);
        await AssertRevogadoAsync(token);
        var novo = FluxoLoginLocal.Payload(await FluxoLoginLocal.EntrarAsync(Api, "carla.alvo"));
        Assert.False(novo.TryGetProperty("roles", out _));
    }

    [Fact]
    public async Task Admin_redefinir_a_senha_revoga()
    {
        var (u, token) = await ComumLogadoAsync();
        Assert.Equal(HttpStatusCode.OK, (await AdminFluig().PostAsync($"/api/fluig/usuarios/{u.Id}/redefinir-senha", null)).StatusCode);
        await AssertRevogadoAsync(token);
    }

    [Fact]
    public async Task Trocar_a_propria_senha_revoga_o_token_anterior()
    {
        var (_, token) = await ComumLogadoAsync();
        Assert.Equal(HttpStatusCode.OK, (await FluxoLoginLocal.TrocarSenhaAsync(Api, token, Semente.SenhaPadrao, "NovaSenha42")).StatusCode);
        await AssertRevogadoAsync(token);
    }

    [Fact]
    public async Task Sair_revoga()
    {
        var (_, token) = await ComumLogadoAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await Api.Cliente(token: token).PostAsync("/api/fluig/auth/sair", null)).StatusCode);
        await AssertRevogadoAsync(token);
    }

    [Fact]
    public async Task Mudar_so_nome_e_email_nao_revoga()
    {
        var (u, token) = await ComumLogadoAsync();
        Assert.Equal(HttpStatusCode.OK,
            (await AtualizarAsync(AdminFluig(), u, false, ativo: true, nome: "Carla Nova", email: "carla.nova@jotanunes.com")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: token).GetAsync("/api/fluig/painel")).StatusCode);
        Assert.Equal(u.VersaoCredencial, (await Semente.RecarregarUsuarioAsync(u.Id)).VersaoCredencial);
    }

    [Fact]
    public async Task Token_com_ver_antigo_uid_de_outro_ou_sub_trocado_e_recusado()
    {
        var u = await Semente.UsuarioInternoAsync("carla.alvo");
        var outro = await Semente.UsuarioInternoAsync("outro.usuario");
        await FluxoLoginLocal.EntrarAsync(Api, "carla.alvo");
        Assert.Equal(HttpStatusCode.OK, (await AtualizarAsync(AdminFluig(), u, false, ativo: false)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await AtualizarAsync(AdminFluig(), u, false, ativo: true)).StatusCode);
        var atual = await Semente.RecarregarUsuarioAsync(u.Id);
        Assert.Equal(2, atual.VersaoCredencial);

        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: Tokens.Local(Api, atual)).GetAsync("/api/fluig/painel")).StatusCode);
        foreach (var (caso, token) in new[]
        {
            ("ver antigo", Tokens.LocalBruto(Api, atual, p => p["ver"] = 1)),
            ("ver futuro", Tokens.LocalBruto(Api, atual, p => p["ver"] = 3)),
            ("uid de outro usuário", Tokens.LocalBruto(Api, atual, p => p["uid"] = outro.Id.ToString())),
            ("uid inexistente", Tokens.LocalBruto(Api, atual, p => p["uid"] = Guid.NewGuid().ToString())),
            ("sub diferente do login do uid", Tokens.LocalBruto(Api, atual, p => p["sub"] = "outro.usuario")),
        })
        {
            var r = await Api.Cliente(token: token).GetAsync("/api/fluig/painel");
            Assert.True(r.StatusCode == HttpStatusCode.Unauthorized, $"{caso} → {(int)r.StatusCode}");
        }
    }
}
