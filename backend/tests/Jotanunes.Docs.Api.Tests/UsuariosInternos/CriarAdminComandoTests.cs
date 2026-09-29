using System.Text.RegularExpressions;
using Jotanunes.Docs.Api.Comandos;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.UsuariosInternos;

/// <summary>
/// Comando <c>criar-admin</c> (US10/AC1–AC6; FR-111, FR-112, SC-015; constituição III v1.2.0): cria o primeiro
/// administrador interno sobre o banco real, mostra a senha provisória só no terminal (nunca no log), recusa a segunda
/// execução e recupera com <c>--forcar</c>.
/// </summary>
public partial class CriarAdminComandoTests(ApiFactory api) : TesteApi(api)
{
    private sealed record Saida(int Codigo, string Out, string Err);

    private async Task<Saida> ExecutarAsync(params string[] args) => await ExecutarAsync(Api.Services, args);

    private static async Task<Saida> ExecutarAsync(IServiceProvider servicos, string[] args)
    {
        using var saida = new StringWriter();
        using var erro = new StringWriter();
        var codigo = await ComandoCriarAdmin.ExecutarAsync(servicos, args, saida, erro);
        return new Saida(codigo, saida.ToString(), erro.ToString());
    }

    private static string[] Args(string login = "Ana.Souza", string nome = "Ana Souza", string email = "ana.souza@jotanunes.com", bool forcar = false)
    {
        var a = new List<string> { "criar-admin", "--login", login, "--nome", nome, "--email", email };
        if (forcar) a.Add("--forcar");
        return [.. a];
    }

    private static string SenhaDaSaida(string saida) => SenhaProvisoria().Match(saida).Groups[1].Value;

    [GeneratedRegex(@"Senha provisória: (\S+)")]
    private static partial Regex SenhaProvisoria();

    [Fact]
    public async Task Banco_sem_usuarios_cria_o_administrador_e_mostra_a_senha_so_no_terminal()
    {
        Api.Logs.Limpar();
        var r = await ExecutarAsync(Args());
        Assert.Equal(0, r.Codigo);
        Assert.Equal("", r.Err);

        var u = Assert.Single(await Semente.UsuariosInternosAsync());
        Assert.Equal("ana.souza", u.Login);
        Assert.Equal("Ana Souza", u.Nome);
        Assert.True(u.Admin);
        Assert.True(u.Ativo);
        Assert.Equal(Domain.UsuariosInternos.SituacaoUsuarioInterno.AGUARDANDO_PRIMEIRO_ACESSO, u.Situacao(Api.Relogio.GetUtcNow()));
        Assert.Equal("sistema", u.CriadoPorLogin);

        var senha = SenhaDaSaida(r.Out);
        Assert.Equal(12, senha.Length);
        Assert.True(BCrypt.Net.BCrypt.Verify(senha, u.SenhaHash));
        Assert.Contains("ana.souza", r.Out);
        Assert.Contains(ApiFactory.FluigAppBaseUrl, r.Out);
        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Equal("ana.souza@jotanunes.com", email.Para);
        Assert.Equal(senha, FluxoLoginLocal.SenhaDoEmail(email));

        Assert.DoesNotContain(senha, string.Join("\n", Api.Logs.Linhas));
        var linha = await AuditoriaTeste.UnicaAsync(Api, "USUARIO_CRIADO");
        Assert.Equal(("SISTEMA", "sistema", "USUARIO_INTERNO", u.Id.ToString()), (linha.AtorTipo, linha.AtorId, linha.RecursoTipo, linha.RecursoId));
        Assert.Null(linha.AtorAdmin);
        await AuditoriaTeste.SemSegredosAsync(Api, [senha]);

        // A senha da saída entra (com troca obrigatória).
        var login = await (await FluxoLoginLocal.LoginAsync(Api, "ana.souza", senha)).LerAsync();
        Assert.True(login.GetProperty("usuario").GetProperty("trocaSenhaObrigatoria").GetBoolean());
        Assert.True(login.GetProperty("usuario").GetProperty("admin").GetBoolean());
    }

    [Fact]
    public async Task Segunda_execucao_codigo_2_sem_alterar_nada()
    {
        Assert.Equal(0, (await ExecutarAsync(Args())).Codigo);
        var antes = Assert.Single(await Semente.UsuariosInternosAsync());
        Api.Emails.Limpar();

        var r = await ExecutarAsync(Args("outro.admin", "Outro Admin", "outro@jotanunes.com"));
        Assert.Equal(2, r.Codigo);
        Assert.Contains("--forcar", r.Err);
        Assert.Equal("", r.Out);
        var depois = Assert.Single(await Semente.UsuariosInternosAsync());
        Assert.Equal((antes.SenhaHash, antes.VersaoCredencial), (depois.SenhaHash, depois.VersaoCredencial));
        Assert.Empty(Api.Emails.Mensagens);

        Assert.Equal(2, (await ExecutarAsync(Args())).Codigo); // o mesmo login também não
        Assert.Single(await AuditoriaTeste.LinhasAsync(Api, "USUARIO_CRIADO"));
    }

    [Fact]
    public async Task Forcar_com_login_existente_comum_e_inativo_vira_admin_ativo_e_revoga_o_token_antigo()
    {
        await Semente.UsuarioInternoAsync("admin.atual", admin: true);
        var antigo = await Semente.UsuarioInternoAsync("ana.souza", "Ana Antiga", "antiga@jotanunes.com", ativo: false);
        var tokenAntigo = Tokens.Local(Api, antigo);

        var r = await ExecutarAsync(Args(forcar: true));
        Assert.Equal(0, r.Codigo);
        var u = await Semente.RecarregarUsuarioAsync(antigo.Id);
        Assert.True(u.Admin);
        Assert.True(u.Ativo);
        Assert.True(u.TrocaSenhaObrigatoria);
        Assert.Equal("Ana Souza", u.Nome);
        Assert.Equal("ana.souza@jotanunes.com", u.Email);
        Assert.Equal(antigo.VersaoCredencial + 1, u.VersaoCredencial);
        Assert.True(BCrypt.Net.BCrypt.Verify(SenhaDaSaida(r.Out), u.SenhaHash));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: tokenAntigo).GetAsync("/api/fluig/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: Tokens.Local(Api, u)).GetAsync("/api/fluig/me")).StatusCode);

        var linha = await AuditoriaTeste.UnicaAsync(Api, "SENHA_REDEFINIDA");
        Assert.Equal(("SISTEMA", "sistema", u.Id.ToString()), (linha.AtorTipo, linha.AtorId, linha.RecursoId));
        Assert.Equal(2, (await Semente.UsuariosInternosAsync()).Count);
    }

    [Fact]
    public async Task Forcar_com_login_novo_cria_mesmo_havendo_administrador()
    {
        await Semente.UsuarioInternoAsync("admin.atual", admin: true);
        var r = await ExecutarAsync(Args("recupera.admin", "Recupera Admin", "recupera@jotanunes.com", forcar: true));
        Assert.Equal(0, r.Codigo);
        Assert.Equal(2, await Api.NoBancoAsync(db => db.UsuariosInternos.CountAsync(u => u.Admin && u.Ativo)));
    }

    public static TheoryData<string[]> ArgumentosInvalidos => new()
    {
        new[] { "criar-admin" },
        new[] { "criar-admin", "--login", "ana.souza", "--nome", "Ana Souza" },
        new[] { "criar-admin", "--login", "--nome", "Ana Souza", "--email", "a@b.com" },
        new[] { "criar-admin", "--login", "ana souza", "--nome", "Ana Souza", "--email", "a@b.com" },
        new[] { "criar-admin", "--login", "ana.souza", "--nome", "Ana Souza", "--email", "sem-arroba" },
        new[] { "criar-admin", "--login", "ana.souza", "--nome", "A", "--email", "a@b.com" },
        new[] { "criar-admin", "--login", "ana.souza", "--nome", "Ana Souza", "--email", "a@b.com", "--senha", "x" },
    };

    [Theory]
    [MemberData(nameof(ArgumentosInvalidos))]
    public async Task Argumentos_invalidos_codigo_1_com_uso(string[] args)
    {
        var r = await ExecutarAsync(args);
        Assert.Equal(1, r.Codigo);
        Assert.Contains("Uso: criar-admin", r.Err);
        Assert.Equal("", r.Out);
        Assert.Empty(await Semente.UsuariosInternosAsync());
        Assert.Empty(Api.Emails.Mensagens);
    }

    [Fact]
    public async Task Aceita_argumentos_com_igual()
    {
        var r = await ExecutarAsync("criar-admin", "--login=ana.souza", "--nome=Ana Souza", "--email=ana@jotanunes.com");
        Assert.Equal(0, r.Codigo);
    }

    [Fact]
    public async Task Login_proprio_desligado_codigo_1()
    {
        var r = await ExecutarAsync(Api.ComLoginLocal(false).Services, Args());
        Assert.Equal(1, r.Codigo);
        Assert.Contains("Auth:LoginLocal:Habilitado", r.Err);
        Assert.Empty(await Semente.UsuariosInternosAsync());
    }

    [Fact]
    public async Task Email_falhando_cria_mostra_a_senha_e_avisa()
    {
        Api.Emails.Falhar = true;
        var r = await ExecutarAsync(Args());
        Assert.Equal(0, r.Codigo);
        Assert.Contains("Aviso", r.Err);
        var u = Assert.Single(await Semente.UsuariosInternosAsync());
        Assert.True(BCrypt.Net.BCrypt.Verify(SenhaDaSaida(r.Out), u.SenhaHash));
    }

    [Fact]
    public async Task Duas_execucoes_simultaneas_em_banco_vazio_criam_um_so_administrador()
    {
        var resultados = await Task.WhenAll(
            ExecutarAsync(Args("admin.um", "Admin Um", "um@jotanunes.com")),
            ExecutarAsync(Args("admin.dois", "Admin Dois", "dois@jotanunes.com")));
        Assert.Equal([0, 2], resultados.Select(r => r.Codigo).OrderBy(c => c));
        Assert.Single(await Semente.UsuariosInternosAsync());
    }
}
