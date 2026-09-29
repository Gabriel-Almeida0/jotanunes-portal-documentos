namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>
/// Perfil lido da claim <c>roles</c> (contracts/fluig-identity.md): só "admin" exato (lista ou texto único) é
/// administrador; qualquer outro caso é comum e o token continua válido (FR-080, FR-086, US6/AC2).
/// </summary>
public class PerfilClaimTests(ApiFactory api) : TesteApi(api)
{
    private static readonly Dictionary<string, (object? Roles, bool Admin)> Casos = new()
    {
        ["lista com admin"] = (new[] { "admin" }, true),
        ["lista com leitor e admin"] = (new[] { "leitor", "admin" }, true),
        ["texto único admin"] = ("admin", true),
        ["ausente"] = (null, false),
        ["lista vazia"] = (Array.Empty<string>(), false),
        ["Admin com maiúscula"] = (new[] { "Admin" }, false),
        ["lista sem admin"] = (new[] { "leitor" }, false),
        ["booleano true"] = (true, false),
        ["número 1"] = (1, false),
        ["objeto"] = (new { admin = true }, false),
        ["lista aninhada"] = (new object[] { new[] { "admin" } }, false),
    };

    public static TheoryData<string> NomesCasos
    {
        get
        {
            var dados = new TheoryData<string>();
            foreach (var nome in Casos.Keys) dados.Add(nome);
            return dados;
        }
    }

    [Theory]
    [MemberData(nameof(NomesCasos))]
    public async Task Me_informa_o_perfil_sem_recusar_o_token(string caso)
    {
        var (roles, admin) = Casos[caso];
        var r = await Api.Cliente(token: Tokens.Fluig(Api, "ana.perfil", "Ana Perfil", "ana@jotanunes.com", roles: roles)).GetAsync("/api/fluig/me");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal(["admin", "email", "login", "nome", "origem", "trocaSenhaObrigatoria"],
            j.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal));
        Assert.Equal("FLUIG", j.Str("origem"));
        Assert.False(j.GetProperty("trocaSenhaObrigatoria").GetBoolean());
        Assert.Equal("ana.perfil", j.Str("login"));
        Assert.Equal("Ana Perfil", j.Str("nome"));
        Assert.Equal("ana@jotanunes.com", j.Str("email"));
        Assert.Equal(admin, j.GetProperty("admin").GetBoolean());
    }

    [Fact]
    public async Task Token_comum_e_token_padrao_dos_testes()
    {
        var comum = await (await Api.Cliente(token: Tokens.FluigComum(Api)).GetAsync("/api/fluig/me")).LerAsync();
        Assert.False(comum.GetProperty("admin").GetBoolean());
        Assert.Equal("joao.comum", comum.Str("login"));

        var padrao = await (await Fluig().GetAsync("/api/fluig/me")).LerAsync();
        Assert.True(padrao.GetProperty("admin").GetBoolean());
    }

    [Fact]
    public async Task Me_do_login_proprio_tem_as_mesmas_chaves_e_perfil_do_cadastro()
    {
        var admin = await Semente.UsuarioInternoAsync("lia.admin", "Lia Admin", "lia@jotanunes.com", admin: true);
        var comum = await Semente.UsuarioInternoAsync("rui.comum", "Rui Comum", "rui@jotanunes.com");

        var ja = await (await Local(admin).GetAsync("/api/fluig/me")).LerAsync();
        Assert.Equal(["admin", "email", "login", "nome", "origem", "trocaSenhaObrigatoria"],
            ja.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal));
        Assert.True(ja.GetProperty("admin").GetBoolean());
        Assert.Equal("LOGIN_LOCAL", ja.Str("origem"));
        Assert.Equal("lia.admin", ja.Str("login"));
        Assert.Equal("Lia Admin", ja.Str("nome"));
        Assert.Equal("lia@jotanunes.com", ja.Str("email"));
        Assert.False(ja.GetProperty("trocaSenhaObrigatoria").GetBoolean());

        var jc = await (await Local(comum).GetAsync("/api/fluig/me")).LerAsync();
        Assert.False(jc.GetProperty("admin").GetBoolean());
        Assert.Equal("LOGIN_LOCAL", jc.Str("origem"));
    }
}
