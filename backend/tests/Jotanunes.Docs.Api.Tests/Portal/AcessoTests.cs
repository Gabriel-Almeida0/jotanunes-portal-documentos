using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Portal;

public class AcessoTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Validar_convite_devolve_cnpj_e_razao_social()
    {
        var empresa = await Semente.EmpresaAsync("Alfa Engenharia Ltda", "11222333000181");
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var r = await FluxoConvite.ValidarAsync(Api, convite.Token);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("11222333000181", j.Str("cnpj"));
        Assert.Equal("Alfa Engenharia Ltda", j.Str("razaoSocial"));
        Assert.True(j.TryGetProperty("expiraEm", out _));
    }

    [Fact]
    public async Task Convite_adulterado_invalido()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var adulterado = (convite.Token[0] == 'A' ? "B" : "A") + convite.Token[1..];
        var r = await FluxoConvite.ValidarAsync(Api, adulterado);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("CONVITE_INVALIDO", await r.CodigoAsync());
        Assert.Equal("Este link não é mais válido.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Token_ausente_vazio_ou_fora_do_tamanho_e_convite_invalido()
    {
        foreach (var corpo in new object[] { new { }, new { token = (string?)null }, new { token = "" }, new { token = "curto" }, new { token = new string('a', 101) } })
        {
            var r = await Anonimo().PostAsJsonAsync("/api/portal/convites/validar", corpo);
            Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
            Assert.Equal("CONVITE_INVALIDO", await r.CodigoAsync());
        }
    }

    [Fact]
    public async Task Corpo_ilegivel_devolve_validacao()
    {
        var r = await Anonimo().PostAsync("/api/portal/convites/validar",
            new StringContent("{\"token\":", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Rota_antiga_com_token_na_url_nao_existe()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var r = await Anonimo().GetAsync($"/api/portal/convites/{convite.Token}");
        Assert.NotEqual(HttpStatusCode.OK, r.StatusCode);
        Assert.DoesNotContain(empresa.Cnpj, await r.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Convite_usado_e_substituido_invalidos()
    {
        var empresa = await Semente.EmpresaAsync();
        var primeiro = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var segundo = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        Assert.Equal("CONVITE_INVALIDO", await (await FluxoConvite.ValidarAsync(Api, primeiro.Token)).CodigoAsync());

        var sessao = await (await FluxoConvite.LoginAsync(Api, empresa.Cnpj, segundo.Senha)).LerAsync();
        await Api.Cliente(token: sessao.Str("accessToken")).PostAsJsonAsync("/api/portal/auth/trocar-senha", new { senhaAtual = segundo.Senha, novaSenha = "Alfa2026ok" });
        var r = await FluxoConvite.ValidarAsync(Api, segundo.Token);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("CONVITE_INVALIDO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Login_com_senha_temporaria_exige_troca()
    {
        var empresa = await Semente.EmpresaAsync("Alfa", "11222333000181");
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var r = await FluxoConvite.LoginAsync(Api, "11.222.333/0001-81", convite.Senha);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.False(string.IsNullOrEmpty(j.Str("accessToken")));
        var expira = j.GetProperty("expiraEm").GetDateTimeOffset();
        Assert.Equal(Api.Relogio.GetUtcNow().AddHours(8), expira, TimeSpan.FromMinutes(1));
        var e = j.GetProperty("empresa");
        Assert.Equal(empresa.Id, e.Id());
        Assert.Equal("11222333000181", e.Str("cnpj"));
        Assert.True(e.GetProperty("trocaSenhaObrigatoria").GetBoolean());
    }

    [Fact]
    public async Task Senha_errada_e_cnpj_inexistente_tem_a_mesma_mensagem()
    {
        var empresa = await Semente.EmpresaAsync();
        await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        var errada = await FluxoConvite.LoginAsync(Api, empresa.Cnpj, "SenhaErrada1");
        var inexistente = await FluxoConvite.LoginAsync(Api, CnpjTeste.Gerar(), "SenhaErrada1");
        var semConvite = await FluxoConvite.LoginAsync(Api, (await Semente.EmpresaAsync()).Cnpj, "SenhaErrada1");
        foreach (var r in new[] { errada, inexistente, semConvite })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, r.StatusCode);
            Assert.Equal("CREDENCIAIS_INVALIDAS", await r.CodigoAsync());
            Assert.Equal("CNPJ ou senha incorretos.", (await r.LerAsync()).Str("title"));
        }
        var registros = await Api.NoBancoAsync(db => db.Auditoria.AsNoTracking().Where(a => a.Acao == "LOGIN_FALHA").CountAsync());
        Assert.Equal(3, registros);
    }

    [Fact]
    public async Task Login_sem_campos_devolve_validacao()
    {
        var r = await Anonimo().PostAsJsonAsync("/api/portal/auth/login", new { cnpj = "" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var erros = (await r.LerAsync()).GetProperty("errors");
        Assert.True(erros.TryGetProperty("cnpj", out _));
        Assert.True(erros.TryGetProperty("senha", out _));
    }

    [Fact]
    public async Task Convite_expirado_apos_7_dias()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        Api.Relogio.Advance(TimeSpan.FromDays(7) + TimeSpan.FromMinutes(1));

        var link = await FluxoConvite.ValidarAsync(Api, convite.Token);
        Assert.Equal(HttpStatusCode.NotFound, link.StatusCode);
        Assert.Equal("CONVITE_INVALIDO", await link.CodigoAsync());

        var login = await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha);
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal("CONVITE_EXPIRADO", await login.CodigoAsync());
        Assert.Equal("Seu convite expirou. Peça um novo convite à Jotanunes.", (await login.LerAsync()).Str("title"));

        var detalhe = await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}")).LerAsync();
        Assert.Equal("CONVITE_EXPIRADO", detalhe.Str("situacaoAcesso"));
        Assert.Equal("EXPIRADO", detalhe.GetProperty("ultimoConvite").Str("situacao"));
    }

    [Fact]
    public async Task Cinco_falhas_bloqueiam_e_a_sexta_devolve_423()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        for (var i = 0; i < 5; i++)
        {
            var falha = await FluxoConvite.LoginAsync(Api, empresa.Cnpj, "Errada" + i);
            Assert.Equal(HttpStatusCode.Unauthorized, falha.StatusCode);
        }
        var r = await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha);
        Assert.Equal((HttpStatusCode)423, r.StatusCode);
        Assert.Equal("ACESSO_BLOQUEADO", await r.CodigoAsync());
        var j = await r.LerAsync();
        Assert.Equal("Muitas tentativas. Tente de novo em 15 minutos.", j.Str("title"));
        var ate = j.GetProperty("bloqueadoAte").GetDateTimeOffset();
        Assert.True(ate > Api.Relogio.GetUtcNow() && ate <= Api.Relogio.GetUtcNow().AddMinutes(15));

        Api.Relogio.Advance(TimeSpan.FromMinutes(16));
        Assert.Equal(HttpStatusCode.OK, (await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha)).StatusCode);
    }

    [Fact]
    public async Task Empresa_desativada_com_senha_certa_recebe_403()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        await Fluig().PutAsJsonAsync($"/api/fluig/empresas/{empresa.Id}", new
        {
            razaoSocial = empresa.RazaoSocial, cnpj = empresa.Cnpj, emailContato = empresa.EmailContato, ativa = false,
        });
        var r = await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha);
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        Assert.Equal("EMPRESA_INATIVA", await r.CodigoAsync());
        Assert.Equal("Esta empresa está desativada.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Decima_primeira_requisicao_do_mesmo_ip_devolve_429()
    {
        const string ip = "203.0.113.77";
        for (var i = 0; i < 10; i++)
        {
            var ok = await Anonimo(ip).PostAsJsonAsync("/api/portal/auth/login", new { cnpj = "11222333000181", senha = "x" });
            Assert.NotEqual(HttpStatusCode.TooManyRequests, ok.StatusCode);
        }
        var r = await FluxoConvite.ValidarAsync(Api, new string('x', 43), ip);
        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
        Assert.Equal("LIMITE_REQUISICOES", await r.CodigoAsync());
        Assert.True(r.Headers.Contains("Retry-After"));

        // outro IP não é afetado
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await FluxoConvite.ValidarAsync(Api, new string('x', 43), "203.0.113.78")).StatusCode);
    }

    [Fact]
    public async Task Login_com_sucesso_registra_auditoria_e_ultimo_acesso()
    {
        var empresa = await Semente.EmpresaAsync();
        var convite = await FluxoConvite.ConvidarAsync(Api, empresa.Id);
        await FluxoConvite.LoginAsync(Api, empresa.Cnpj, convite.Senha, ip: "198.51.100.9");
        var registro = await Api.NoBancoAsync(db => db.Auditoria.AsNoTracking().SingleAsync(a => a.Acao == "LOGIN_SUCESSO"));
        Assert.Equal("EMPRESA", registro.AtorTipo);
        Assert.Equal(empresa.Id.ToString(), registro.AtorId);
        Assert.Equal("198.51.100.9", registro.Ip);
        Assert.NotNull((await Semente.RecarregarEmpresaAsync(empresa.Id)).UltimoAcessoEm);
    }
}
