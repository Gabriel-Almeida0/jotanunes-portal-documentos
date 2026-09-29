namespace Jotanunes.Docs.Api.Tests.Fluig;

public class VinculosTiposTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Vincular_e_idempotente_e_desvincular()
    {
        var c = Fluig();
        var obra = await Semente.ObraAsync();
        var beta = await Semente.EmpresaAsync("Beta Serviços");
        var alfa = await Semente.EmpresaAsync("Alfa Engenharia");

        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{beta.Id}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{alfa.Id}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{alfa.Id}", null)).StatusCode);

        var detalhe = await (await c.GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync();
        var empresas = detalhe.GetProperty("empresas").EnumerateArray().ToList();
        Assert.Equal(2, empresas.Count);
        Assert.Equal(new[] { "Alfa Engenharia", "Beta Serviços" }, empresas.Select(e => e.Str("razaoSocial")));
        var primeira = empresas[0];
        Assert.Equal(alfa.Id, primeira.Id("empresaId"));
        Assert.Equal(alfa.Cnpj, primeira.Str("cnpj"));
        Assert.Equal("NAO_CONVIDADA", primeira.Str("situacaoAcesso"));
        Assert.True(primeira.TryGetProperty("vinculadoEm", out _));
        Assert.Equal(0, primeira.GetProperty("documentos").GetProperty("total").GetInt32());

        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync($"/api/fluig/obras/{obra.Id}/empresas/{alfa.Id}")).StatusCode);
        var r404 = await c.DeleteAsync($"/api/fluig/obras/{obra.Id}/empresas/{alfa.Id}");
        Assert.Equal(HttpStatusCode.NotFound, r404.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r404.CodigoAsync());
        Assert.Single((await (await c.GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync()).GetProperty("empresas").EnumerateArray());
    }

    [Fact]
    public async Task Vincular_com_obra_ou_empresa_inexistente_devolve_404()
    {
        var c = Fluig();
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await c.PutAsync($"/api/fluig/obras/{Guid.NewGuid()}/empresas/{empresa.Id}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{Guid.NewGuid()}", null)).StatusCode);
    }

    [Fact]
    public async Task Vinculos_simultaneos_nao_duplicam()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        var respostas = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Fluig().PutAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}", null)));
        Assert.All(respostas, r => Assert.Equal(HttpStatusCode.NoContent, r.StatusCode));
        Assert.Equal(1, await Api.NoBancoAsync(db => Task.FromResult(db.ObraEmpresas.Count(v => v.ObraId == obra.Id))));
    }

    [Fact]
    public async Task Contagem_de_documentos_no_detalhe_da_obra()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        await Semente.VincularAsync(obra, empresa);
        var t1 = await Semente.TipoAsync();
        var t2 = await Semente.TipoAsync();
        var t3 = await Semente.TipoAsync();
        await Semente.TipoAsync();
        await Semente.EnvioAsync(empresa, t1, Domain.Envios.StatusEnvio.APROVADO);
        await Semente.EnvioAsync(empresa, t2, Domain.Envios.StatusEnvio.REJEITADO);
        await Semente.EnvioAsync(empresa, t2, Domain.Envios.StatusEnvio.EM_ANALISE);
        await Semente.EnvioAsync(empresa, t3, Domain.Envios.StatusEnvio.REJEITADO);

        var docs = (await (await Fluig().GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync()).GetProperty("empresas")[0].GetProperty("documentos");
        Assert.Equal(4, docs.GetProperty("total").GetInt32());
        Assert.Equal(1, docs.GetProperty("aprovados").GetInt32());
        Assert.Equal(1, docs.GetProperty("emAnalise").GetInt32());
        Assert.Equal(1, docs.GetProperty("rejeitados").GetInt32());
        Assert.Equal(1, docs.GetProperty("pendentes").GetInt32());
    }

    [Fact]
    public async Task Tipos_criar_obter_atualizar_e_listar()
    {
        var c = Fluig();
        var r = await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "Cartão CNPJ", instrucoes = "Emitido há menos de 30 dias" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var t = await r.LerAsync();
        Assert.Equal($"/api/fluig/tipos-documento/{t.Id()}", r.Headers.Location!.OriginalString);
        Assert.True(t.GetProperty("ativo").GetBoolean());
        Assert.True(t.TryGetProperty("criadoEm", out _));

        var obtido = await c.GetAsync($"/api/fluig/tipos-documento/{t.Id()}");
        Assert.Equal(HttpStatusCode.OK, obtido.StatusCode);
        Assert.Equal("Emitido há menos de 30 dias", (await obtido.LerAsync()).Str("instrucoes"));
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/tipos-documento/{Guid.NewGuid()}")).StatusCode);

        var put = await c.PutAsJsonAsync($"/api/fluig/tipos-documento/{t.Id()}", new { nome = "Cartão CNPJ atualizado", instrucoes = (string?)null, ativo = false });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var atualizado = await put.LerAsync();
        Assert.Equal("Cartão CNPJ atualizado", atualizado.Str("nome"));
        Assert.Equal(JsonValueKind.Null, atualizado.GetProperty("instrucoes").ValueKind);
        Assert.False(atualizado.GetProperty("ativo").GetBoolean());

        await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "PCMSO" });
        await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "CND Federal" });
        var todos = (await (await c.GetAsync("/api/fluig/tipos-documento")).LerAsync()).EnumerateArray().Select(x => x.Str("nome")).ToList();
        Assert.Equal(new[] { "Cartão CNPJ atualizado", "CND Federal", "PCMSO" }, todos);
        Assert.Equal(2, (await (await c.GetAsync("/api/fluig/tipos-documento?ativo=true")).LerAsync()).GetArrayLength());
        Assert.Equal(1, (await (await c.GetAsync("/api/fluig/tipos-documento?ativo=false")).LerAsync()).GetArrayLength());
    }

    [Fact]
    public async Task Tipo_nome_duplicado_sem_diferenciar_maiusculas()
    {
        var c = Fluig();
        await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "PCMSO" });
        var r = await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "pcmso" });
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("NOME_DUPLICADO", await r.CodigoAsync());
        Assert.Equal("Já existe um tipo de documento com este nome.", (await r.LerAsync()).Str("title"));

        var outro = await (await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "NR-35" })).LerAsync();
        var put = await c.PutAsJsonAsync($"/api/fluig/tipos-documento/{outro.Id()}", new { nome = "Pcmso", ativo = true });
        Assert.Equal(HttpStatusCode.Conflict, put.StatusCode);
        Assert.Equal("NOME_DUPLICADO", await put.CodigoAsync());
    }

    [Fact]
    public async Task Tipo_invalido_devolve_validacao()
    {
        var r = await Fluig().PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "ab" });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.True((await r.LerAsync()).GetProperty("errors").TryGetProperty("nome", out _));
    }

    [Fact]
    public async Task Tipos_ativos_definem_documentos_exigidos_de_todas_as_empresas()
    {
        var c = Fluig();
        var e1 = await Semente.EmpresaAsync();
        var e2 = await Semente.EmpresaAsync();
        var t = await (await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "Cartão CNPJ" })).LerAsync();

        async Task<JsonElement> Docs(Guid id) => (await (await c.GetAsync($"/api/fluig/empresas/{id}")).LerAsync()).GetProperty("documentos");
        Assert.Equal(1, (await Docs(e1.Id)).GetProperty("pendentes").GetInt32());

        // criar tipo novo aumenta pendentes de todas as empresas ativas (FR-015)
        await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "NR-35" });
        Assert.Equal(2, (await Docs(e1.Id)).GetProperty("pendentes").GetInt32());
        Assert.Equal(2, (await Docs(e2.Id)).GetProperty("total").GetInt32());

        // desativar reduz o total
        await c.PutAsJsonAsync($"/api/fluig/tipos-documento/{t.Id()}", new { nome = "Cartão CNPJ", ativo = false });
        var d = await Docs(e1.Id);
        Assert.Equal(1, d.GetProperty("total").GetInt32());
        Assert.Equal(1, d.GetProperty("pendentes").GetInt32());
        var lista = (await (await c.GetAsync("/api/fluig/empresas")).LerAsync()).GetProperty("itens");
        Assert.All(lista.EnumerateArray(), i => Assert.Equal(1, i.GetProperty("documentos").GetProperty("total").GetInt32()));
    }
}
