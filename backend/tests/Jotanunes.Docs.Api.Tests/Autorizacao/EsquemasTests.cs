namespace Jotanunes.Docs.Api.Tests.Autorizacao;

public class EsquemasTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Health_sem_token()
    {
        var r = await Anonimo().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("ok", (await r.LerAsync()).Str("status"));
    }

    [Fact]
    public async Task Me_com_token_fluig_valido()
    {
        var r = await Api.Cliente(token: Tokens.Fluig(Api, "dev.analista", "Analista Dev", "analista@jotanunes.com")).GetAsync("/api/fluig/me");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("dev.analista", j.Str("login"));
        Assert.Equal("Analista Dev", j.Str("nome"));
        Assert.Equal("analista@jotanunes.com", j.Str("email"));
    }

    [Fact]
    public async Task Me_sem_email_devolve_vazio()
    {
        var r = await Api.Cliente(token: Tokens.Fluig(Api, email: null)).GetAsync("/api/fluig/me");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("", (await r.LerAsync()).Str("email"));
    }

    public static TheoryData<string, Func<ApiFactory, string?>> TokensInvalidos => new()
    {
        { "sem token", _ => null },
        { "expirado", a => Tokens.Fluig(a, emitidoHa: TimeSpan.FromHours(9)) },
        { "expirado há 3 min (acima da tolerância)", a => Tokens.Fluig(a, validade: TimeSpan.FromHours(1), emitidoHa: TimeSpan.FromMinutes(63)) },
        { "segredo errado", a => Tokens.Fluig(a, segredo: "outro-segredo-qualquer-com-mais-de-32-bytes!!") },
        { "iss errado", a => Tokens.Fluig(a, iss: "outro") },
        { "aud errado", a => Tokens.Fluig(a, aud: "outra-api") },
        { "alg none", a => Tokens.AlgNone(a) },
        { "validade acima de 8h", a => Tokens.Fluig(a, validade: TimeSpan.FromHours(8) + TimeSpan.FromMinutes(1)) },
        { "sem iat", a => Tokens.Fluig(a, incluirIat: false) },
        { "sub vazio", a => Tokens.Fluig(a, login: "") },
        { "name vazio", a => Tokens.Fluig(a, nome: " ") },
        { "token do portal", a => Tokens.Portal(a, Guid.NewGuid(), "11222333000181", 1, false) },
        { "lixo", _ => "nao.e.jwt" },
    };

    [Theory]
    [MemberData(nameof(TokensInvalidos))]
    public async Task Me_recusa_token_invalido(string caso, Func<ApiFactory, string?> gerar)
    {
        var r = await Api.Cliente(token: gerar(Api)).GetAsync("/api/fluig/me");
        Assert.True(r.StatusCode == HttpStatusCode.Unauthorized, caso);
        Assert.Equal("NAO_AUTENTICADO", await r.CodigoAsync());
        Assert.Equal("Sua sessão expirou. Entre de novo.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Token_expirado_dentro_da_tolerancia_de_2_minutos_e_aceito()
    {
        var r = await Api.Cliente(token: Tokens.Fluig(Api, validade: TimeSpan.FromHours(1), emitidoHa: TimeSpan.FromMinutes(61))).GetAsync("/api/fluig/me");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
    }

    [Fact]
    public async Task Portal_me_recusa_token_fluig()
    {
        var r = await Fluig().GetAsync("/api/portal/me");
        Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
        Assert.Equal("NAO_AUTENTICADO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Rota_inexistente_devolve_problema_404()
    {
        var r = await Fluig().GetAsync("/api/fluig/nao-existe");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Headers_de_seguranca_e_cors()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/health");
        req.Headers.Add("Origin", "http://localhost:5174");
        var r = await Anonimo().SendAsync(req);
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("no-referrer", r.Headers.GetValues("Referrer-Policy").Single());
        Assert.Equal("DENY", r.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("http://localhost:5174", r.Headers.GetValues("Access-Control-Allow-Origin").Single());

        var outra = new HttpRequestMessage(HttpMethod.Get, "/health");
        outra.Headers.Add("Origin", "http://malicioso.test");
        var r2 = await Anonimo().SendAsync(outra);
        Assert.False(r2.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Preflight_cors_do_fluig_app()
    {
        var req = new HttpRequestMessage(HttpMethod.Options, "/api/fluig/obras");
        req.Headers.Add("Origin", "http://localhost:5173");
        req.Headers.Add("Access-Control-Request-Method", "POST");
        req.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");
        var r = await Anonimo().SendAsync(req);
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
        Assert.Equal("http://localhost:5173", r.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task Json_invalido_vira_validacao()
    {
        var r = await Fluig().PostAsync("/api/fluig/obras", new StringContent("{nao json", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
    }
}
