namespace Jotanunes.Docs.Api.Tests.AcessoJotanunes;

/// <summary>
/// Login próprio da área Jotanunes (US8; FR-101, FR-104, FR-113, FR-114, SC-014): sessão e claims, anti-enumeração,
/// bloqueio, recusas com senha certa, limite por IP, configuração e auditoria.
/// </summary>
public class LoginLocalTests(ApiFactory api) : TesteApi(api)
{
    private const string TituloLoginInvalido = "Login ou senha incorretos.";

    [Fact]
    public async Task Login_devolve_sessao_com_token_do_login_proprio()
    {
        var admin = await Semente.UsuarioInternoAsync("ana.souza", "Ana Souza", "ana.souza@jotanunes.com", admin: true);
        var r = await FluxoLoginLocal.LoginAsync(Api, "ana.souza", Semente.SenhaPadrao);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        var usuario = j.GetProperty("usuario");
        Assert.Equal("LOGIN_LOCAL", usuario.Str("origem"));
        Assert.Equal("ana.souza", usuario.Str("login"));
        Assert.Equal("Ana Souza", usuario.Str("nome"));
        Assert.Equal("ana.souza@jotanunes.com", usuario.Str("email"));
        Assert.True(usuario.GetProperty("admin").GetBoolean());
        Assert.False(usuario.GetProperty("trocaSenhaObrigatoria").GetBoolean());

        var token = j.Str("accessToken");
        var p = FluxoLoginLocal.Payload(token);
        Assert.Equal("jotanunes-docs", p.Str("iss"));
        Assert.Equal("jotanunes-docs-api", p.Str("aud"));
        Assert.Equal("ana.souza", p.Str("sub"));
        Assert.Equal("Ana Souza", p.Str("name"));
        Assert.Equal("ana.souza@jotanunes.com", p.Str("email"));
        Assert.Equal(["admin"], p.GetProperty("roles").EnumerateArray().Select(e => e.GetString()!));
        Assert.Equal(admin.Id.ToString(), p.Str("uid"));
        Assert.Equal(admin.VersaoCredencial, p.GetProperty("ver").GetInt32());
        Assert.False(p.GetProperty("troca_senha").GetBoolean());
        Assert.Equal(8 * 3600, p.GetProperty("exp").GetInt64() - p.GetProperty("iat").GetInt64());
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(p.GetProperty("exp").GetInt64()), j.GetProperty("expiraEm").GetDateTimeOffset(), TimeSpan.FromSeconds(1));

        // O token abre a área Jotanunes.
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: token).GetAsync("/api/fluig/painel")).StatusCode);
        Assert.NotNull((await Semente.RecarregarUsuarioAsync(admin.Id)).UltimoAcessoEm);
    }

    [Fact]
    public async Task Usuario_comum_recebe_token_sem_roles_e_senha_provisoria_volta_com_troca_pendente()
    {
        await Semente.UsuarioInternoAsync("caio.comum", trocaSenhaObrigatoria: true);
        var j = await (await FluxoLoginLocal.LoginAsync(Api, "caio.comum", Semente.SenhaPadrao)).LerAsync();
        var p = FluxoLoginLocal.Payload(j.Str("accessToken"));
        Assert.False(p.TryGetProperty("roles", out _));
        Assert.True(p.GetProperty("troca_senha").GetBoolean());
        Assert.False(j.GetProperty("usuario").GetProperty("admin").GetBoolean());
        Assert.True(j.GetProperty("usuario").GetProperty("trocaSenhaObrigatoria").GetBoolean());
    }

    [Theory]
    [InlineData("ANA.SOUZA")]
    [InlineData("  Ana.Souza  ")]
    public async Task Login_sem_diferenciar_maiusculas_e_sem_espacos_nas_pontas(string digitado)
    {
        await Semente.UsuarioInternoAsync("ana.souza");
        Assert.Equal(HttpStatusCode.OK, (await FluxoLoginLocal.LoginAsync(Api, digitado, Semente.SenhaPadrao)).StatusCode);
    }

    [Fact]
    public async Task Senha_errada_e_login_inexistente_tem_a_mesma_resposta()
    {
        await Semente.UsuarioInternoAsync("ana.souza");
        var errada = await FluxoLoginLocal.LoginAsync(Api, "ana.souza", "SenhaErrada99");
        var inexistente = await FluxoLoginLocal.LoginAsync(Api, "nao.existe", "SenhaErrada99");
        foreach (var r in new[] { errada, inexistente })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
            Assert.Equal("LOGIN_INVALIDO", await r.CodigoAsync());
            Assert.Equal(TituloLoginInvalido, (await r.LerAsync()).Str("title"));
        }
        var chaves = async (HttpResponseMessage r) => (await r.LerAsync()).EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToList();
        Assert.Equal(await chaves(errada), await chaves(inexistente));
    }

    [Theory]
    [InlineData("existente")]
    [InlineData("inexistente")]
    [InlineData("formato inválido")]
    public async Task Anti_enumeracao_mesma_sequencia_401x5_e_423(string caso)
    {
        await Semente.UsuarioInternoAsync("ana.souza");
        var login = caso switch
        {
            "existente" => "ana.souza",
            "inexistente" => "fulano.nao.existe",
            _ => "joão da silva!",
        };
        var ip = "10.200.1." + Random.Shared.Next(1, 250);
        var codigos = new List<string>();
        JsonElement ultimo = default;
        for (var i = 0; i < 6; i++)
        {
            var r = await FluxoLoginLocal.LoginAsync(Api, login, "SenhaErrada99", ip);
            ultimo = await r.LerAsync();
            codigos.Add($"{(int)r.StatusCode} {ultimo.Str("code")}");
        }
        Assert.Equal(Enumerable.Repeat("401 LOGIN_INVALIDO", 5).Append("423 ACESSO_BLOQUEADO").ToList(), codigos);
        Assert.Equal(Api.Relogio.GetUtcNow().AddMinutes(15), ultimo.GetProperty("bloqueadoAte").GetDateTimeOffset(), TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Bloqueado_com_a_senha_certa_continua_423_ate_passar_o_bloqueio()
    {
        await Semente.UsuarioInternoAsync("ana.souza");
        for (var i = 0; i < 5; i++) await FluxoLoginLocal.LoginAsync(Api, "ana.souza", "SenhaErrada99");
        var r = await FluxoLoginLocal.LoginAsync(Api, "ana.souza", Semente.SenhaPadrao);
        Assert.Equal((HttpStatusCode)423, r.StatusCode);
        Assert.Equal("ACESSO_BLOQUEADO", await r.CodigoAsync());

        Api.Relogio.Advance(TimeSpan.FromMinutes(16));
        Assert.Equal(HttpStatusCode.OK, (await FluxoLoginLocal.LoginAsync(Api, "ana.souza", Semente.SenhaPadrao)).StatusCode);
    }

    [Fact]
    public async Task Desativado_com_a_senha_certa_403_e_com_a_errada_401()
    {
        await Semente.UsuarioInternoAsync("ex.colaborador", ativo: false);
        var certa = await FluxoLoginLocal.LoginAsync(Api, "ex.colaborador", Semente.SenhaPadrao);
        Assert.Equal(HttpStatusCode.Forbidden, certa.StatusCode);
        Assert.Equal("USUARIO_INATIVO", await certa.CodigoAsync());
        Assert.Equal("Este usuário está desativado. Fale com um administrador do sistema.", (await certa.LerAsync()).Str("title"));

        var errada = await FluxoLoginLocal.LoginAsync(Api, "ex.colaborador", "SenhaErrada99");
        Assert.Equal(HttpStatusCode.Unauthorized, errada.StatusCode);
        Assert.Equal("LOGIN_INVALIDO", await errada.CodigoAsync());
    }

    [Fact]
    public async Task Senha_provisoria_vencida_401_SENHA_PROVISORIA_EXPIRADA()
    {
        await Semente.UsuarioInternoAsync("novo.usuario", trocaSenhaObrigatoria: true);
        Api.Relogio.Advance(TimeSpan.FromDays(7) + TimeSpan.FromMinutes(1));
        var r = await FluxoLoginLocal.LoginAsync(Api, "novo.usuario", Semente.SenhaPadrao);
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        Assert.Equal("SENHA_PROVISORIA_EXPIRADA", await r.CodigoAsync());
    }

    [Fact]
    public async Task Decima_primeira_requisicao_do_mesmo_ip_somando_portal_e_area_jotanunes_devolve_429()
    {
        var ip = "10.201.2." + Random.Shared.Next(1, 250);
        for (var i = 0; i < 5; i++)
        {
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await FluxoConvite.LoginAsync(Api, CnpjTeste.Gerar(), "SenhaErrada99", ip)).StatusCode);
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await FluxoLoginLocal.LoginAsync(Api, $"login.{i}", "SenhaErrada99", ip)).StatusCode);
        }
        var r = await FluxoLoginLocal.LoginAsync(Api, "mais.um", "SenhaErrada99", ip);
        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
        Assert.Equal("LIMITE_REQUISICOES", await r.CodigoAsync());
        Assert.True(r.Headers.Contains("Retry-After"));
    }

    [Fact]
    public async Task Validacao_do_corpo()
    {
        var r = await Anonimo().PostAsJsonAsync("/api/fluig/auth/login", new { login = " ", senha = "" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
        var erros = (await r.LerAsync()).GetProperty("errors");
        Assert.True(erros.TryGetProperty("login", out _));
        Assert.True(erros.TryGetProperty("senha", out _));
    }

    [Fact]
    public async Task Configuracao_anonima_diz_que_o_login_proprio_esta_ligado()
    {
        var r = await Anonimo().GetAsync("/api/fluig/auth/configuracao");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.True((await r.LerAsync()).GetProperty("loginLocalHabilitado").GetBoolean());
        Assert.Contains("no-store", r.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Login_proprio_desligado_404_nas_rotas_e_token_local_401()
    {
        var u = await Semente.UsuarioInternoAsync("ana.souza", admin: true);
        var tokenLocal = Tokens.Local(Api, u);
        var desligado = Api.ComLoginLocal(false);
        HttpClient Cliente(string? token = null)
        {
            var c = desligado.CreateClient();
            c.DefaultRequestHeaders.Add(IpDeTesteStartupFilter.Header, "10.202.3." + Random.Shared.Next(1, 250));
            if (token is not null) c.DefaultRequestHeaders.Authorization = new("Bearer", token);
            return c;
        }

        var cfg = await Cliente().GetAsync("/api/fluig/auth/configuracao");
        Assert.Equal(HttpStatusCode.OK, cfg.StatusCode);
        Assert.False((await cfg.LerAsync()).GetProperty("loginLocalHabilitado").GetBoolean());

        var login = await Cliente().PostAsJsonAsync("/api/fluig/auth/login", new { login = "ana.souza", senha = Semente.SenhaPadrao });
        Assert.Equal(HttpStatusCode.NotFound, login.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await login.CodigoAsync());

        var fluig = Tokens.Fluig(Api);
        var troca = await Cliente(fluig).PostAsJsonAsync("/api/fluig/auth/trocar-senha", new { senhaAtual = "x", novaSenha = "NovaSenha42" });
        Assert.Equal(HttpStatusCode.NotFound, troca.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await troca.CodigoAsync());
        var sair = await Cliente(fluig).PostAsync("/api/fluig/auth/sair", null);
        Assert.Equal(HttpStatusCode.NotFound, sair.StatusCode);

        var me = await Cliente(tokenLocal).GetAsync("/api/fluig/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
        Assert.Equal("NAO_AUTENTICADO", await me.CodigoAsync());
        // O token do Fluig continua funcionando.
        Assert.Equal(HttpStatusCode.OK, (await Cliente(fluig).GetAsync("/api/fluig/me")).StatusCode);
        // E o mesmo token local vale no host com o login ligado.
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: tokenLocal).GetAsync("/api/fluig/me")).StatusCode);
    }

    [Fact]
    public async Task Auditoria_do_login()
    {
        var u = await Semente.UsuarioInternoAsync("ana.souza", admin: true);
        var inativo = await Semente.UsuarioInternoAsync("ex.colaborador", ativo: false);
        await FluxoLoginLocal.EntrarAsync(Api, "ana.souza");
        await FluxoLoginLocal.LoginAsync(Api, "ana.souza", "SenhaErrada99");
        await FluxoLoginLocal.LoginAsync(Api, "Fulano.Nao.Existe", "SenhaErrada99");
        await FluxoLoginLocal.LoginAsync(Api, "MinhaSenha Secreta!", "SenhaErrada99");
        await FluxoLoginLocal.LoginAsync(Api, "ex.colaborador", Semente.SenhaPadrao);

        var sucesso = await AuditoriaTeste.UnicaAsync(Api, "LOGIN_SUCESSO");
        Assert.Equal("LOCAL", sucesso.AtorTipo);
        Assert.Equal("ana.souza", sucesso.AtorId);
        Assert.True(sucesso.AtorAdmin);
        Assert.Equal("USUARIO_INTERNO", sucesso.RecursoTipo);
        Assert.Equal(u.Id.ToString(), sucesso.RecursoId);

        var falhas = await AuditoriaTeste.LinhasAsync(Api, "LOGIN_FALHA");
        Assert.Equal(4, falhas.Count);
        Assert.All(falhas, f => Assert.Equal("ANONIMO", f.AtorTipo));
        Assert.All(falhas, f => Assert.Null(f.AtorAdmin));
        Assert.Equal(("ana.souza", "USUARIO_INTERNO", u.Id.ToString()), (falhas[0].AtorId, falhas[0].RecursoTipo, falhas[0].RecursoId));
        Assert.Equal(("fulano.nao.existe", (string?)null, (string?)null), (falhas[1].AtorId, falhas[1].RecursoTipo, falhas[1].RecursoId));
        Assert.Null(falhas[2].AtorId); // fora do formato de login: pode ser uma senha digitada no campo errado
        Assert.Equal(("ex.colaborador", inativo.Id.ToString()), (falhas[3].AtorId, falhas[3].RecursoId)); // senha certa, recusado

        // 1 falha acima + 4 aqui = 5ª falha bloqueia; a seguinte já encontra o bloqueio.
        for (var i = 0; i < 4; i++) await FluxoLoginLocal.LoginAsync(Api, "ana.souza", "SenhaErrada99");
        await FluxoLoginLocal.LoginAsync(Api, "ana.souza", "SenhaErrada99");
        var bloqueios = await AuditoriaTeste.LinhasAsync(Api, "LOGIN_BLOQUEADO");
        Assert.Equal(2, bloqueios.Count); // o que bloqueou e a tentativa durante o bloqueio
        Assert.All(bloqueios, b => Assert.Equal(("ANONIMO", "ana.souza"), (b.AtorTipo, b.AtorId)));
        await AuditoriaTeste.SemSegredosAsync(Api, ["SenhaErrada99", Semente.SenhaPadrao, "MinhaSenha Secreta!".ToLowerInvariant()]);
    }

    [Fact]
    public async Task Log_nao_contem_a_senha_digitada_nem_o_token()
    {
        await Semente.UsuarioInternoAsync("ana.souza");
        Api.Logs.Limpar();
        var token = await FluxoLoginLocal.EntrarAsync(Api, "ana.souza");
        await FluxoLoginLocal.LoginAsync(Api, "ana.souza", "OutraSenhaErrada77");
        await FluxoLoginLocal.LoginAsync(Api, "nao.existe", "MaisUmaSenha55");

        var logs = string.Join("\n", Api.Logs.Linhas);
        Assert.NotEmpty(Api.Logs.Linhas);
        foreach (var segredo in new[] { Semente.SenhaPadrao, "OutraSenhaErrada77", "MaisUmaSenha55", token, ApiFactory.SegredoLoginLocal })
        {
            Assert.DoesNotContain(segredo, logs);
        }
    }
}
