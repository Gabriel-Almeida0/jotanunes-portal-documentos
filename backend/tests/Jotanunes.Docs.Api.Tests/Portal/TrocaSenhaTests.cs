using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Portal;

public class TrocaSenhaTests(ApiFactory api) : TesteApi(api)
{
    private async Task<(Domain.Empresas.Empresa Empresa, ConviteRecebido Convite, string Token)> LogadoComTrocaPendenteAsync()
    {
        var empresa = await Semente.EmpresaAsync("Alfa Engenharia Ltda");
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var sessao = await (await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha)).LerAsync();
        return (empresa, convite, sessao.Str("accessToken"));
    }

    [Fact]
    public async Task Com_troca_pendente_me_responde_e_demais_rotas_devolvem_403()
    {
        var (empresa, _, token) = await LogadoComTrocaPendenteAsync();
        var c = Api.Cliente(token: token);
        var me = await c.GetAsync("/api/portal/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var j = await me.LerAsync();
        Assert.Equal(empresa.Id, j.Id());
        Assert.Equal("Alfa Engenharia Ltda", j.Str("razaoSocial"));
        Assert.True(j.GetProperty("trocaSenhaObrigatoria").GetBoolean());

        foreach (var url in new[] { "/api/portal/documentos", $"/api/portal/documentos/{Guid.NewGuid()}/envios", $"/api/portal/envios/{Guid.NewGuid()}/arquivo" })
        {
            var r = await c.GetAsync(url);
            Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
            Assert.Equal("TROCA_SENHA_OBRIGATORIA", await r.CodigoAsync());
            Assert.Equal("Crie uma nova senha para continuar.", (await r.LerAsync()).Str("title"));
        }
        var post = await c.PostAsync($"/api/portal/documentos/{Guid.NewGuid()}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()));
        Assert.Equal(HttpStatusCode.Forbidden, post.StatusCode);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("somenteletras")]
    [InlineData("12345678")]
    public async Task Senha_fraca(string nova)
    {
        var (_, convite, token) = await LogadoComTrocaPendenteAsync();
        var r = await Api.Cliente(token: token).PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = convite.Senha, novaSenha = nova });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("SENHA_FRACA", await r.CodigoAsync());
        Assert.Equal("A senha precisa ter pelo menos 8 caracteres, com letras e números.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Nova_igual_a_atual_e_fraca()
    {
        var (_, convite, token) = await LogadoComTrocaPendenteAsync();
        var r = await Api.Cliente(token: token).PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = convite.Senha, novaSenha = convite.Senha });
        Assert.Equal("SENHA_FRACA", await r.CodigoAsync());
    }

    [Fact]
    public async Task Senha_atual_errada()
    {
        var (_, _, token) = await LogadoComTrocaPendenteAsync();
        var r = await Api.Cliente(token: token).PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = "Errada123", novaSenha = "Alfa2026ok" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("SENHA_ATUAL_INCORRETA", await r.CodigoAsync());
    }

    [Fact]
    public async Task Troca_bem_sucedida_revoga_token_antigo_e_marca_convite_usado()
    {
        var (empresa, convite, tokenAntigo) = await LogadoComTrocaPendenteAsync();
        var r = await Api.Cliente(token: tokenAntigo).PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = convite.Senha, novaSenha = "Alfa2026ok" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var sessao = await r.LerAsync();
        Assert.False(sessao.GetProperty("empresa").GetProperty("trocaSenhaObrigatoria").GetBoolean());
        var novo = sessao.Str("accessToken");

        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: novo).GetAsync("/api/portal/documentos")).StatusCode);
        var antigo = await Api.Cliente(token: tokenAntigo).GetAsync("/api/portal/me");
        Assert.Equal(HttpStatusCode.Unauthorized, antigo.StatusCode);
        Assert.Equal("NAO_AUTENTICADO", await antigo.CodigoAsync());

        var convites = await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}/convites")).LerAsync();
        Assert.Equal("USADO", convites[0].Str("situacao"));
        Assert.NotEqual(JsonValueKind.Null, convites[0].GetProperty("usadoEm").ValueKind);
        Assert.Equal("ATIVA", (await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}")).LerAsync()).Str("situacaoAcesso"));

        // senha temporária não vale mais; a nova vale
        Assert.Equal(HttpStatusCode.Unauthorized, (await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha)).StatusCode);
        var login = await FluxoConvite.LoginAsync(Api, empresa.Cnpj, "Alfa2026ok");
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.False((await login.LerAsync()).GetProperty("empresa").GetProperty("trocaSenhaObrigatoria").GetBoolean());
    }

    [Fact]
    public async Task Troca_de_senha_registra_senha_trocada_na_auditoria_sem_segredos()
    {
        var (empresa, convite, token) = await LogadoComTrocaPendenteAsync();
        var c = Api.Cliente(ip: "198.51.100.30", token: token);
        Assert.Equal("SENHA_ATUAL_INCORRETA", await (await c.PostAsJsonAsync("/api/portal/auth/trocar-senha",
            new { senhaAtual = "Errada123", novaSenha = "Alfa2026ok" })).CodigoAsync());
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "SENHA_TROCADA")));

        var r = await c.PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = convite.Senha, novaSenha = "Alfa2026ok" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var novoToken = (await r.LerAsync()).Str("accessToken");

        var linha = await Api.NoBancoAsync(db => db.Auditoria.AsNoTracking().SingleAsync(a => a.Acao == "SENHA_TROCADA"));
        Assert.Equal("EMPRESA", linha.AtorTipo);
        Assert.Equal(empresa.Id.ToString(), linha.AtorId);
        Assert.Equal("EMPRESA", linha.RecursoTipo);
        Assert.Equal(empresa.Id.ToString(), linha.RecursoId);
        Assert.Equal("198.51.100.30", linha.Ip);
        await AuditoriaTeste.SemSegredosAsync(Api, [convite.Senha, "Alfa2026ok", "Errada123", token, novoToken, convite.Token]);
    }

    [Fact]
    public async Task Reenvio_de_convite_derruba_sessao_ativa()
    {
        var empresa = await Semente.EmpresaAsync();
        var token = await FluxoConvite.PrimeiroAcessoAsync(Api, empresa.Id, empresa.Cnpj);
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: token).GetAsync("/api/portal/documentos")).StatusCode);

        var novo = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: token).GetAsync("/api/portal/documentos")).StatusCode);
        var login = await (await FluxoConvite.LoginAsync(Api, empresa.Cnpj, novo.Senha)).LerAsync();
        Assert.True(login.GetProperty("empresa").GetProperty("trocaSenhaObrigatoria").GetBoolean());
        Assert.Equal(HttpStatusCode.Unauthorized, (await FluxoConvite.LoginAsync(Api, empresa.Cnpj, "Alfa2026ok")).StatusCode);
    }

    [Fact]
    public async Task Desativar_empresa_derruba_sessao()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        Assert.Equal(HttpStatusCode.OK, (await Api.Cliente(token: token).GetAsync("/api/portal/me")).StatusCode);
        await Fluig().PutAsJsonAsync($"/api/fluig/empresas/{empresa.Id}", new
        {
            razaoSocial = empresa.RazaoSocial, cnpj = empresa.Cnpj, emailContato = empresa.EmailContato, ativa = false,
        });
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: token).GetAsync("/api/portal/me")).StatusCode);
    }

    [Fact]
    public async Task Token_fluig_nao_serve_no_portal()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Fluig().GetAsync("/api/portal/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Fluig().PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = "a", novaSenha = "b" })).StatusCode);
    }

    [Fact]
    public async Task Token_do_portal_expirado_ou_com_segredo_errado()
    {
        var (empresa, _) = await Semente.EmpresaComAcessoAsync();
        var expirado = Tokens.Portal(Api, empresa.Id, empresa.Cnpj, empresa.VersaoCredencial, false, emitidoHa: TimeSpan.FromHours(9));
        var segredo = Tokens.Portal(Api, empresa.Id, empresa.Cnpj, empresa.VersaoCredencial, false, segredo: ApiFactory.SegredoFluig);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: expirado).GetAsync("/api/portal/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: segredo).GetAsync("/api/portal/me")).StatusCode);
    }
}
