namespace Jotanunes.Docs.Api.Tests.Fluig;

public class EmpresasTests(ApiFactory api) : TesteApi(api)
{
    private static object NovaEmpresa(string cnpj, string razao = "Alfa Engenharia Ltda", string email = "contato@alfa.test", string? telefone = null) =>
        new { razaoSocial = razao, cnpj, emailContato = email, telefone, nomeContato = "Fulano", nomeFantasia = "Alfa" };

    [Fact]
    public async Task Criar_com_cnpj_mascarado()
    {
        await Semente.TipoAsync();
        await Semente.TipoAsync();
        await Semente.TipoAsync(ativo: false);
        var r = await Fluig().PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("11.222.333/0001-81", telefone: "(79) 3333-4444"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal($"/api/fluig/empresas/{j.Id()}", r.Headers.Location!.OriginalString);
        Assert.Equal("11222333000181", j.Str("cnpj"));
        Assert.Equal("NAO_CONVIDADA", j.Str("situacaoAcesso"));
        Assert.True(j.GetProperty("cnpjEditavel").GetBoolean());
        Assert.True(j.GetProperty("ativa").GetBoolean());
        Assert.Equal("7933334444", j.Str("telefone"));
        Assert.Equal(0, j.GetProperty("obras").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, j.GetProperty("ultimoConvite").ValueKind);
        var docs = j.GetProperty("documentos");
        Assert.Equal(2, docs.GetProperty("total").GetInt32());
        Assert.Equal(2, docs.GetProperty("pendentes").GetInt32());
        Assert.Equal(0, docs.GetProperty("emAnalise").GetInt32());
        Assert.Equal(0, docs.GetProperty("aprovados").GetInt32());
        Assert.Equal(0, docs.GetProperty("rejeitados").GetInt32());
    }

    [Fact]
    public async Task Criar_com_cnpj_alfanumerico()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("12.ABC.345/01DE-35", "Beta Serviços", "contato@beta.test"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.Equal("12ABC34501DE35", (await r.LerAsync()).Str("cnpj"));
    }

    [Theory]
    [InlineData("11222333000181")]
    [InlineData("11.222.333/0001-81")]
    public async Task Cnpj_repetido_com_ou_sem_mascara(string repetido)
    {
        var c = Fluig();
        await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("11.222.333/0001-81"));
        var r = await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa(repetido, "Outra"));
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("CNPJ_DUPLICADO", await r.CodigoAsync());
        Assert.Equal("Já existe uma empresa com este CNPJ.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Dv_invalido_devolve_erro_no_campo()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("12.ABC.345/01DE-36"));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
        Assert.Equal("CNPJ inválido.", (await r.LerAsync()).GetProperty("errors").GetProperty("cnpj")[0].GetString());
    }

    [Fact]
    public async Task Listar_com_busca_por_nome_e_cnpj_e_filtro_de_obra()
    {
        var c = Fluig();
        var alfa = await (await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("11.222.333/0001-81", "Alfa Engenharia Ltda"))).LerAsync();
        await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("12.ABC.345/01DE-35", "Beta Serviços", "contato@beta.test"));
        var obra = await Semente.ObraAsync();
        await c.PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{alfa.Id()}", null);

        var todas = await (await c.GetAsync("/api/fluig/empresas")).LerAsync();
        Assert.Equal(2, todas.GetProperty("total").GetInt32());
        Assert.Equal("Alfa Engenharia Ltda", todas.GetProperty("itens")[0].Str("razaoSocial"));
        var item = todas.GetProperty("itens")[0];
        foreach (var campo in new[] { "id", "razaoSocial", "nomeFantasia", "cnpj", "emailContato", "ativa", "situacaoAcesso", "documentos" })
        {
            Assert.True(item.TryGetProperty(campo, out _), campo);
        }

        async Task<int> Total(string q) => (await (await c.GetAsync("/api/fluig/empresas?" + q)).LerAsync()).GetProperty("total").GetInt32();
        Assert.Equal(1, await Total("busca=servicos"));
        Assert.Equal(1, await Total("busca=ENGENHARIA"));
        Assert.Equal(1, await Total("busca=11.222.333"));
        Assert.Equal(1, await Total("busca=11222333000181"));
        Assert.Equal(1, await Total("busca=12.abc"));
        Assert.Equal(1, await Total($"obraId={obra.Id}"));
        Assert.Equal(0, await Total($"obraId={Guid.NewGuid()}"));
    }

    [Fact]
    public async Task Obter_detalhe_com_obras()
    {
        var c = Fluig();
        var e = await (await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("11222333000181"))).LerAsync();
        var obra = await Semente.ObraAsync("Residencial Vista do Rio");
        await c.PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{e.Id()}", null);
        var j = await (await c.GetAsync($"/api/fluig/empresas/{e.Id()}")).LerAsync();
        var o = j.GetProperty("obras")[0];
        Assert.Equal(obra.Id, o.Id());
        Assert.Equal("Residencial Vista do Rio", o.Str("nome"));
        Assert.Equal("SE", o.Str("uf"));
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/empresas/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task Atualizar_e_desativar()
    {
        var c = Fluig();
        var e = await (await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("11222333000181"))).LerAsync();
        var r = await c.PutAsJsonAsync($"/api/fluig/empresas/{e.Id()}", new
        {
            razaoSocial = "Alfa Nova", cnpj = "12.345.678/0001-95", emailContato = "novo@alfa.test", ativa = false,
        });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("Alfa Nova", j.Str("razaoSocial"));
        Assert.Equal("12345678000195", j.Str("cnpj"));
        Assert.False(j.GetProperty("ativa").GetBoolean());
        Assert.Equal("DESATIVADA", j.Str("situacaoAcesso"));
        var empresa = await Semente.RecarregarEmpresaAsync(j.Id());
        Assert.Equal(1, empresa.VersaoCredencial);
    }

    [Fact]
    public async Task Atualizar_para_cnpj_de_outra_empresa_e_conflito()
    {
        var c = Fluig();
        await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("11222333000181"));
        var b = await (await c.PostAsJsonAsync("/api/fluig/empresas", NovaEmpresa("12345678000195", "Beta"))).LerAsync();
        var r = await c.PutAsJsonAsync($"/api/fluig/empresas/{b.Id()}", new { razaoSocial = "Beta", cnpj = "11222333000181", emailContato = "a@b.test", ativa = true });
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("CNPJ_DUPLICADO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Email_e_telefone_invalidos()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/empresas", new { razaoSocial = "Alfa", cnpj = "11222333000181", emailContato = "x", telefone = "123" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        var erros = (await r.LerAsync()).GetProperty("errors");
        Assert.True(erros.TryGetProperty("emailContato", out _));
        Assert.True(erros.TryGetProperty("telefone", out _));
    }
}
