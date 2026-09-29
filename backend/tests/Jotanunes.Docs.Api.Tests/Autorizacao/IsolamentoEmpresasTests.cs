using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Api.Tests.Autorizacao;

/// <summary>Uma empresa nunca vê/baixa/envia documentos de outra (FR-035, SC-003).</summary>
public class IsolamentoEmpresasTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Empresa_B_nao_acessa_dados_da_empresa_A()
    {
        var (a, tokenA) = await Semente.EmpresaComAcessoAsync("Alfa");
        var (b, tokenB) = await Semente.EmpresaComAcessoAsync("Beta");
        var tipo = await Semente.TipoAsync("Cartão CNPJ");
        var envioA = await (await Api.Cliente(token: tokenA).PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()))).LerAsync();

        var cb = Api.Cliente(token: tokenB);
        var download = await cb.GetAsync($"/api/portal/envios/{envioA.Id()}/arquivo");
        Assert.Equal(HttpStatusCode.NotFound, download.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await download.CodigoAsync());

        Assert.Equal(0, (await (await cb.GetAsync($"/api/portal/documentos/{tipo.Id}/envios")).LerAsync()).GetArrayLength());

        var docsB = await (await cb.GetAsync("/api/portal/documentos")).LerAsync();
        Assert.Equal("PENDENTE_ENVIO", docsB[0].Str("situacao"));
        Assert.True(docsB[0].GetProperty("podeEnviar").GetBoolean());

        // B pode enviar o mesmo tipo (documentos são por empresa)
        Assert.Equal(HttpStatusCode.Created, (await cb.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
        Assert.Equal(1, (await (await Api.Cliente(token: tokenA).GetAsync($"/api/portal/documentos/{tipo.Id}/envios")).LerAsync()).GetArrayLength());
        Assert.NotEqual(a.Id, b.Id);
    }

    [Fact]
    public async Task Token_com_sub_de_outra_empresa_e_segredo_errado_nao_passa()
    {
        var (a, _) = await Semente.EmpresaComAcessoAsync();
        var forjado = Tokens.Portal(Api, a.Id, a.Cnpj, a.VersaoCredencial, false, segredo: "segredo-inventado-por-atacante-com-32-bytes!!");
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: forjado).GetAsync("/api/portal/documentos")).StatusCode);
        var versaoVelha = Tokens.Portal(Api, a.Id, a.Cnpj, a.VersaoCredencial - 1, false);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: versaoVelha).GetAsync("/api/portal/documentos")).StatusCode);
        var inexistente = Tokens.Portal(Api, Guid.NewGuid(), a.Cnpj, a.VersaoCredencial, false);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Api.Cliente(token: inexistente).GetAsync("/api/portal/documentos")).StatusCode);
    }

    [Fact]
    public async Task Todas_as_rotas_autenticadas_do_portal_recusam_sem_token_e_com_token_fluig()
    {
        var anonimas = new[] { "/api/portal/auth/login", "/api/portal/convites/{token}" };
        var rotas = Rota.Registradas(Api)
            .Where(r => r.Padrao.StartsWith("/api/portal/", StringComparison.Ordinal) && !anonimas.Contains(r.Padrao))
            .ToList();
        Assert.True(rotas.Count >= 6, $"achou {rotas.Count}");
        var tokenFluig = Tokens.Fluig(Api);
        var c = Anonimo();
        var falhas = new List<string>();
        foreach (var rota in rotas)
        {
            foreach (var (caso, token) in new[] { ("sem token", (string?)null), ("token Fluig", tokenFluig) })
            {
                var r = await c.SendAsync(rota.Requisicao(token));
                if (r.StatusCode != HttpStatusCode.Unauthorized || await r.CodigoAsync() != "NAO_AUTENTICADO") falhas.Add($"{rota} ({caso}) → {(int)r.StatusCode}");
            }
        }
        Assert.Empty(falhas);
    }

    [Fact]
    public async Task EnvioPortal_nunca_expoe_quem_analisou()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var tipo = await Semente.TipoAsync();
        await Semente.EnvioAsync(empresa, tipo, StatusEnvio.APROVADO);
        var c = Api.Cliente(token: token);
        var textoDocs = await (await c.GetAsync("/api/portal/documentos")).Content.ReadAsStringAsync();
        var textoHist = await (await c.GetAsync($"/api/portal/documentos/{tipo.Id}/envios")).Content.ReadAsStringAsync();
        foreach (var t in new[] { textoDocs, textoHist })
        {
            Assert.DoesNotContain("analisadoPor", t);
            Assert.DoesNotContain("analista", t, StringComparison.OrdinalIgnoreCase);
        }
    }
}
