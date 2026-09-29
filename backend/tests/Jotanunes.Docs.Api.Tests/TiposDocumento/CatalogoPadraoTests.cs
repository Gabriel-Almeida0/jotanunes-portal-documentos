using Jotanunes.Docs.Application.TiposDocumento;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jotanunes.Docs.Api.Tests.TiposDocumento;

/// <summary>
/// Catálogo padrão criado na inicialização só quando não há nenhum tipo (FR-090, FR-091, FR-092, FR-015, SC-010,
/// US7/AC1–AC5). Cada "host" é uma nova inicialização da API sobre o mesmo banco do Testcontainers.
/// </summary>
public class CatalogoPadraoTests(ApiFactory api) : TesteApi(api)
{
    private static HttpClient Cliente(WebApplicationFactory<Program> host, string token)
    {
        var c = host.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        c.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return c;
    }

    private static async Task SubirAsync(WebApplicationFactory<Program> host) =>
        Assert.NotNull(await Task.Run(() => host.Services)); // força a inicialização (migrations + semeador)

    private Task<int> ContarTiposAsync() => Api.NoBancoAsync(db => db.TiposDocumento.CountAsync());

    [Fact]
    public async Task Banco_vazio_ganha_os_10_tipos_padrao_ao_subir()
    {
        await using var host = Api.ComCatalogoPadrao();
        var r = await Cliente(host, Tokens.FluigComum(Api)).GetAsync("/api/fluig/tipos-documento");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var tipos = (await r.LerAsync()).EnumerateArray().ToList();
        Assert.Equal(10, tipos.Count);
        Assert.All(tipos, t => Assert.True(t.GetProperty("ativo").GetBoolean()));
        var porNome = tipos.ToDictionary(t => t.Str("nome"), t => t.Str("instrucoes"));
        Assert.All(CatalogoTiposPadrao.Itens, item => Assert.Equal(item.Instrucoes, porNome[item.Nome]));

        var autores = await Api.NoBancoAsync(db => db.TiposDocumento.Select(t => t.CriadoPorLogin).Distinct().ToListAsync());
        Assert.Equal(["sistema"], autores);
    }

    [Fact]
    public async Task Tres_reinicios_seguidos_continuam_com_exatamente_os_mesmos_10()
    {
        List<Guid>? ids = null;
        for (var i = 0; i < 3; i++)
        {
            await using var host = Api.ComCatalogoPadrao();
            await SubirAsync(host);
            var atuais = await Api.NoBancoAsync(db => db.TiposDocumento.Select(t => t.Id).OrderBy(id => id).ToListAsync());
            Assert.Equal(10, atuais.Count);
            if (ids is not null) Assert.Equal(ids, atuais);
            ids = atuais;
        }
    }

    [Fact]
    public async Task Cinco_semeadores_simultaneos_sobre_banco_vazio_criam_exatamente_10()
    {
        var execucoes = Enumerable.Range(0, 5).Select(_ => Task.Run(async () =>
        {
            await using var scope = Api.Services.CreateAsyncScope();
            return await scope.ServiceProvider.GetRequiredService<SemearCatalogoTiposPadrao>().ExecutarAsync();
        }));

        var criados = await Task.WhenAll(execucoes);

        Assert.Equal(10, criados.Sum());
        Assert.Equal(10, await ContarTiposAsync());
    }

    [Fact]
    public async Task Com_um_tipo_inativo_existente_nao_cria_nada()
    {
        var antigo = await Semente.TipoAsync("Tipo antigo", ativo: false);
        await using var host = Api.ComCatalogoPadrao();
        await SubirAsync(host);

        var tipos = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().ToListAsync());
        var unico = Assert.Single(tipos);
        Assert.Equal(antigo.Id, unico.Id);
        Assert.False(unico.Ativo);
    }

    [Fact]
    public async Task Edicao_e_desativacao_do_admin_sobrevivem_ao_reinicio()
    {
        Guid id;
        await using (var host = Api.ComCatalogoPadrao())
        {
            var admin = Cliente(host, Tokens.Fluig(Api));
            var cartao = (await (await admin.GetAsync("/api/fluig/tipos-documento")).LerAsync()).EnumerateArray().Single(t => t.Str("nome") == "Cartão CNPJ");
            id = cartao.Id();
            var r = await admin.PutAsJsonAsync($"/api/fluig/tipos-documento/{id}",
                new { nome = "Cartão CNPJ (emitido há 30 dias)", instrucoes = "Texto ajustado pelo administrador.", ativo = false });
            Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        }

        await using (var host = Api.ComCatalogoPadrao())
        {
            await SubirAsync(host);
        }

        var tipo = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().SingleAsync(t => t.Id == id));
        Assert.Equal("Cartão CNPJ (emitido há 30 dias)", tipo.Nome);
        Assert.Equal("Texto ajustado pelo administrador.", tipo.Instrucoes);
        Assert.False(tipo.Ativo);
        Assert.Equal(10, await ContarTiposAsync());
        Assert.False(await Api.NoBancoAsync(db => db.TiposDocumento.AnyAsync(t => t.Nome == "Cartão CNPJ")));
    }

    [Fact]
    public async Task Empresa_ativa_existente_passa_a_ter_10_pendencias()
    {
        var empresa = await Semente.EmpresaAsync();
        await using var host = Api.ComCatalogoPadrao();

        var r = await Cliente(host, Tokens.FluigComum(Api)).GetAsync($"/api/fluig/empresas/{empresa.Id}");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var documentos = (await r.LerAsync()).GetProperty("documentos");
        Assert.Equal(10, documentos.GetProperty("total").GetInt32());
        Assert.Equal(10, documentos.GetProperty("pendentes").GetInt32());
    }

    [Fact]
    public async Task Semeador_desligado_nao_cria_tipos()
    {
        await using var host = Api.ComCatalogoPadrao(semear: false);
        var r = await Cliente(host, Tokens.FluigComum(Api)).GetAsync("/api/fluig/tipos-documento");

        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Empty((await r.LerAsync()).EnumerateArray());
        Assert.Equal(0, await ContarTiposAsync());
    }
}
