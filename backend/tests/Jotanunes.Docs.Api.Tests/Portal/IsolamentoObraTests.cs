using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Portal;

/// <summary>
/// US2 (002), research R8: no portal, {obraId} só é resolvido entre obras ATIVAS com vínculo ATIVO da empresa do
/// token. Qualquer outro caso → 404 NAO_ENCONTRADO em todas as rotas de obra, sem efeito.
/// </summary>
public class IsolamentoObraTests(ApiFactory api) : TesteApi(api)
{
    private static IEnumerable<(string Metodo, string Url)> RotasDeObra(Obra o, TipoDocumento t) =>
    [
        ("GET", $"/api/portal/obras/{o.Id}/documentos"),
        ("GET", $"/api/portal/obras/{o.Id}/documentos/{t.Id}/envios"),
        ("POST", $"/api/portal/obras/{o.Id}/documentos/{t.Id}/envios"),
    ];

    private static async Task<HttpResponseMessage> ChamarAsync(HttpClient c, string metodo, string url) =>
        metodo == "GET" ? await c.GetAsync(url) : await c.PostAsync(url, ArquivosTeste.Form(ArquivosTeste.Pdf()));

    private async Task Todas404Async(HttpClient c, Obra o, TipoDocumento t, string caso)
    {
        foreach (var (metodo, url) in RotasDeObra(o, t))
        {
            var r = await ChamarAsync(c, metodo, url);
            Assert.True(r.StatusCode == HttpStatusCode.NotFound, $"{caso}: {metodo} {url} → {(int)r.StatusCode}");
            Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());
        }
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Envios.CountAsync(e => e.ObraId == o.Id && e.Status == StatusEnvio.EM_ANALISE)));
    }

    [Fact]
    public async Task Obra_de_outra_empresa_404()
    {
        var (_, token) = await Semente.EmpresaComAcessoAsync();
        var outra = await Semente.EmpresaAsync();
        var obra = await Semente.ObraAsync();
        await Semente.VincularAsync(obra, outra);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        await Todas404Async(Api.Cliente(token: token), obra, art, "outra empresa");
        Assert.Empty((await (await Api.Cliente(token: token).GetAsync("/api/portal/obras")).LerAsync()).EnumerateArray());
    }

    [Fact]
    public async Task Vinculo_encerrado_404()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var obra = await Semente.ObraAsync();
        await Semente.VincularAsync(obra, empresa, encerrado: true);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        await Todas404Async(Api.Cliente(token: token), obra, art, "vínculo encerrado");
    }

    [Fact]
    public async Task Obra_inativa_404()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var obra = await Semente.ObraAsync(ativa: false);
        await Semente.VincularAsync(obra, empresa);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        await Todas404Async(Api.Cliente(token: token), obra, art, "obra inativa");
    }

    [Fact]
    public async Task Obra_inexistente_404()
    {
        var (_, token) = await Semente.EmpresaComAcessoAsync();
        var art = await Semente.TipoPorObraAsync();
        var fantasma = Obra.Criar("Fantasma", null, "Aracaju", "SE", "x", DateTimeOffset.UtcNow);
        await Todas404Async(Api.Cliente(token: token), fantasma, art, "obra inexistente");
    }

    [Fact]
    public async Task Tipo_nao_marcado_na_obra_404_no_historico_e_no_envio()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var obra = await Semente.ObraAsync();
        await Semente.VincularAsync(obra, empresa);
        var naoMarcado = await Semente.TipoPorObraAsync();
        var c = Api.Cliente(token: token);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/portal/obras/{obra.Id}/documentos/{naoMarcado.Id}/envios")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await c.PostAsync($"/api/portal/obras/{obra.Id}/documentos/{naoMarcado.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await c.GetAsync($"/api/portal/obras/{obra.Id}/documentos/{Guid.NewGuid()}/envios")).StatusCode);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Envios.CountAsync()));
    }

    [Fact]
    public async Task Download_de_envio_da_obra_exige_vinculo_ativo_e_obra_ativa()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var obra = await Semente.ObraAsync();
        await Semente.VincularAsync(obra, empresa);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        var envio = await Semente.EnvioObraAsync(obra, empresa, art, StatusEnvio.APROVADO);
        var c = Api.Cliente(token: token);
        var url = $"/api/portal/envios/{envio.Id}/arquivo";
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync(url)).StatusCode);

        // Encerrar o vínculo pela área Jotanunes → download some do portal.
        Assert.Equal(HttpStatusCode.NoContent, (await Fluig().DeleteAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}")).StatusCode);
        var r = await c.GetAsync(url);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());

        // Reabrir devolve o acesso; desativar a obra tira de novo.
        Assert.Equal(HttpStatusCode.NoContent, (await Fluig().PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync(url)).StatusCode);
        await Fluig().PutAsJsonAsync($"/api/fluig/obras/{obra.Id}", new { nome = obra.Nome, cidade = obra.Cidade, uf = "SE", ativa = false });
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync(url)).StatusCode);

        // A área Jotanunes continua baixando (histórico).
        Assert.Equal(HttpStatusCode.OK, (await Fluig().GetAsync($"/api/fluig/envios/{envio.Id}/arquivo")).StatusCode);
    }

    [Fact]
    public async Task Envio_da_obra_de_outra_empresa_404_no_download()
    {
        var (_, token) = await Semente.EmpresaComAcessoAsync();
        var outra = await Semente.EmpresaAsync();
        var obra = await Semente.ObraAsync();
        await Semente.VincularAsync(obra, outra);
        var art = await Semente.TipoPorObraAsync();
        var envio = await Semente.EnvioObraAsync(obra, outra, art);
        Assert.Equal(HttpStatusCode.NotFound, (await Api.Cliente(token: token).GetAsync($"/api/portal/envios/{envio.Id}/arquivo")).StatusCode);
    }

    [Fact]
    public async Task Token_fluig_e_anonimo_nas_rotas_novas_do_portal_401()
    {
        var obra = await Semente.ObraAsync();
        var art = await Semente.TipoPorObraAsync();
        var urls = new[] { "/api/portal/obras" }.Concat(RotasDeObra(obra, art).Select(r => r.Url)).ToList();
        foreach (var cliente in new[] { Fluig(), Anonimo() })
        {
            foreach (var url in urls)
            {
                var r = await cliente.GetAsync(url);
                Assert.True(r.StatusCode == HttpStatusCode.Unauthorized, $"GET {url} → {(int)r.StatusCode}");
                Assert.Equal("NAO_AUTENTICADO", await r.CodigoAsync());
            }
            var post = await cliente.PostAsync(RotasDeObra(obra, art).Last().Url, ArquivosTeste.Form(ArquivosTeste.Pdf()));
            Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
        }
    }

    [Fact]
    public async Task Troca_de_senha_pendente_bloqueia_as_rotas_novas()
    {
        var empresa = await Semente.EmpresaAsync();
        var token = Tokens.Portal(Api, empresa.Id, empresa.Cnpj, empresa.VersaoCredencial, trocaSenha: true);
        var r = await Api.Cliente(token: token).GetAsync("/api/portal/obras");
        Assert.True(r.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized, $"→ {(int)r.StatusCode}");
    }
}
