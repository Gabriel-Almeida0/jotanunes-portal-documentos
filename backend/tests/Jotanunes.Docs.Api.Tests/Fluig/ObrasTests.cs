namespace Jotanunes.Docs.Api.Tests.Fluig;

public class ObrasTests(ApiFactory api) : TesteApi(api)
{
    private static object NovaObra(string nome = "Residencial Vista do Rio", string? codigo = null, string cidade = "Aracaju", string uf = "SE") =>
        new { nome, codigo, cidade, uf };

    [Fact]
    public async Task Criar_devolve_201_com_location()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/obras", NovaObra(codigo: "RVR-01"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal($"/api/fluig/obras/{j.Id()}", r.Headers.Location!.OriginalString);
        Assert.Equal("Residencial Vista do Rio", j.Str("nome"));
        Assert.Equal("RVR-01", j.Str("codigo"));
        Assert.Equal("Aracaju", j.Str("cidade"));
        Assert.Equal("SE", j.Str("uf"));
        Assert.True(j.GetProperty("ativa").GetBoolean());
        Assert.True(j.TryGetProperty("criadoEm", out _));
    }

    [Fact]
    public async Task Listar_com_busca_ativa_paginacao_e_quantidade_de_empresas()
    {
        var c = Fluig();
        var a = await (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Edifício Árvore", "ARV", "Maceió", "AL"))).LerAsync();
        await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Condomínio Beira Mar", null, "Aracaju", "SE"));
        var inativa = await (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Obra Antiga", null, "Recife", "PE"))).LerAsync();
        await c.PutAsJsonAsync($"/api/fluig/obras/{inativa.Id()}", new { nome = "Obra Antiga", cidade = "Recife", uf = "PE", ativa = false });
        var e1 = await Semente.EmpresaAsync();
        var e2 = await Semente.EmpresaAsync();
        await c.PutAsync($"/api/fluig/obras/{a.Id()}/empresas/{e1.Id}", null);
        await c.PutAsync($"/api/fluig/obras/{a.Id()}/empresas/{e2.Id}", null);

        var todas = await (await c.GetAsync("/api/fluig/obras")).LerAsync();
        Assert.Equal(3, todas.GetProperty("total").GetInt32());
        Assert.Equal(1, todas.GetProperty("pagina").GetInt32());
        Assert.Equal(20, todas.GetProperty("tamanhoPagina").GetInt32());
        var nomes = todas.GetProperty("itens").EnumerateArray().Select(i => i.Str("nome")).ToList();
        Assert.Equal(new[] { "Condomínio Beira Mar", "Edifício Árvore", "Obra Antiga" }, nomes);
        var arv = todas.GetProperty("itens").EnumerateArray().Single(i => i.Str("nome") == "Edifício Árvore");
        Assert.Equal(2, arv.GetProperty("quantidadeEmpresas").GetInt32());

        // busca sem acento e sem diferenciar maiúsculas, por nome, código e cidade
        Assert.Equal(1, (await (await c.GetAsync("/api/fluig/obras?busca=arvore")).LerAsync()).GetProperty("total").GetInt32());
        Assert.Equal(1, (await (await c.GetAsync("/api/fluig/obras?busca=arv")).LerAsync()).GetProperty("total").GetInt32());
        Assert.Equal(1, (await (await c.GetAsync("/api/fluig/obras?busca=maceio")).LerAsync()).GetProperty("total").GetInt32());
        Assert.Equal(0, (await (await c.GetAsync("/api/fluig/obras?busca=%25")).LerAsync()).GetProperty("total").GetInt32());

        Assert.Equal(2, (await (await c.GetAsync("/api/fluig/obras?ativa=true")).LerAsync()).GetProperty("total").GetInt32());
        Assert.Equal(1, (await (await c.GetAsync("/api/fluig/obras?ativa=false")).LerAsync()).GetProperty("total").GetInt32());

        var p2 = await (await c.GetAsync("/api/fluig/obras?pagina=2&tamanhoPagina=2")).LerAsync();
        Assert.Equal(3, p2.GetProperty("total").GetInt32());
        Assert.Single(p2.GetProperty("itens").EnumerateArray());
        Assert.Equal("Obra Antiga", p2.GetProperty("itens")[0].Str("nome"));
    }

    [Theory]
    [InlineData("pagina=0")]
    [InlineData("tamanhoPagina=0")]
    [InlineData("tamanhoPagina=101")]
    public async Task Paginacao_invalida_devolve_validacao(string query)
    {
        var r = await Fluig().GetAsync("/api/fluig/obras?" + query);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Obter_detalhe_com_empresas()
    {
        var c = Fluig();
        var o = await (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra())).LerAsync();
        var r = await c.GetAsync($"/api/fluig/obras/{o.Id()}");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal(o.Id(), j.Id());
        Assert.Equal(0, j.GetProperty("empresas").GetArrayLength());
    }

    [Fact]
    public async Task Atualizar_e_desativar()
    {
        var c = Fluig();
        var o = await (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra())).LerAsync();
        var r = await c.PutAsJsonAsync($"/api/fluig/obras/{o.Id()}", new { nome = "Novo nome", codigo = "N1", cidade = "Maceió", uf = "AL", ativa = false });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("Novo nome", j.Str("nome"));
        Assert.Equal("AL", j.Str("uf"));
        Assert.False(j.GetProperty("ativa").GetBoolean());
    }

    [Fact]
    public async Task Atualizar_sem_ativa_devolve_validacao()
    {
        var c = Fluig();
        var o = await (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra())).LerAsync();
        var r = await c.PutAsJsonAsync($"/api/fluig/obras/{o.Id()}", NovaObra());
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.True((await r.LerAsync()).GetProperty("errors").TryGetProperty("ativa", out _));
    }

    [Fact]
    public async Task Codigo_duplicado_sem_diferenciar_maiusculas()
    {
        var c = Fluig();
        await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Obra Um", "abc-1"));
        var r = await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Obra Dois", "ABC-1"));
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("CODIGO_OBRA_DUPLICADO", await r.CodigoAsync());
        Assert.Equal("Já existe uma obra com este código.", (await r.LerAsync()).Str("title"));

        var outra = await (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Obra Três", "XYZ"))).LerAsync();
        var put = await c.PutAsJsonAsync($"/api/fluig/obras/{outra.Id()}", new { nome = "Obra Três", codigo = "Abc-1", cidade = "Aracaju", uf = "SE", ativa = true });
        Assert.Equal(HttpStatusCode.Conflict, put.StatusCode);
        Assert.Equal("CODIGO_OBRA_DUPLICADO", await put.CodigoAsync());

        // várias obras sem código não conflitam
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Sem código 1"))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsJsonAsync("/api/fluig/obras", NovaObra("Sem código 2"))).StatusCode);
    }

    [Fact]
    public async Task Uf_invalida_devolve_validacao_com_campo()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/obras", NovaObra(uf: "XX"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
        var j = await r.LerAsync();
        Assert.Equal("Confira os dados informados.", j.Str("title"));
        Assert.True(j.GetProperty("errors").GetProperty("uf").GetArrayLength() > 0);
    }

    [Fact]
    public async Task Id_inexistente_devolve_404()
    {
        var c = Fluig();
        var r = await c.GetAsync($"/api/fluig/obras/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());
        var put = await c.PutAsJsonAsync($"/api/fluig/obras/{Guid.NewGuid()}", new { nome = "Obra", cidade = "Aracaju", uf = "SE", ativa = true });
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
    }

    [Fact]
    public async Task Autoria_registrada_com_login_fluig()
    {
        var r = await Fluig("joao.pedro", "João Pedro").PostAsJsonAsync("/api/fluig/obras", NovaObra());
        var id = (await r.LerAsync()).Id();
        var login = await Api.NoBancoAsync(async db => (await db.Obras.FindAsync(id))!.CriadoPorLogin);
        Assert.Equal("joao.pedro", login);
    }
}
