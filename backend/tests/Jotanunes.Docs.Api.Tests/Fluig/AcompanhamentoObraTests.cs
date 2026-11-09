using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Api.Tests.Fluig;

/// <summary>US4 (002): contagens gerais e por obra no detalhe da obra, da empresa, nas listas e no painel.</summary>
public class AcompanhamentoObraTests(ApiFactory api) : TesteApi(api)
{
    private static void AssertContagem(JsonElement c, int total, int pendentes, int emAnalise, int aprovados, int rejeitados)
    {
        Assert.Equal(total, c.GetProperty("total").GetInt32());
        Assert.Equal(pendentes, c.GetProperty("pendentes").GetInt32());
        Assert.Equal(emAnalise, c.GetProperty("emAnalise").GetInt32());
        Assert.Equal(aprovados, c.GetProperty("aprovados").GetInt32());
        Assert.Equal(rejeitados, c.GetProperty("rejeitados").GetInt32());
    }

    [Fact]
    public async Task Detalhe_da_obra_separa_documentos_da_obra_e_gerais()
    {
        var obra = await Semente.ObraAsync();
        var outra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        await Semente.VincularAsync(obra, empresa);
        await Semente.VincularAsync(outra, empresa);
        var art = await Semente.TipoPorObraAsync("ART da obra");
        var os = await Semente.TipoPorObraAsync("Ordem de serviço");
        var desmarcado = await Semente.TipoPorObraAsync("Desmarcado");
        await Semente.MarcarAsync(obra, art, os);
        await Semente.MarcarAsync(outra, art);
        var g1 = await Semente.TipoAsync("Cartão CNPJ");
        await Semente.TipoAsync("PCMSO");
        await Semente.EnvioObraAsync(obra, empresa, art, StatusEnvio.APROVADO);
        await Semente.EnvioObraAsync(obra, empresa, desmarcado, StatusEnvio.REJEITADO); // tipo não marcado: só conta envio
        await Semente.EnvioObraAsync(outra, empresa, art, StatusEnvio.EM_ANALISE);       // outra obra: não conta
        await Semente.EnvioAsync(empresa, g1, StatusEnvio.EM_ANALISE);

        var detalhe = await (await Fluig().GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync();
        Assert.Equal(2, detalhe.GetProperty("quantidadeTiposExigidos").GetInt32());
        var e = Assert.Single(detalhe.GetProperty("empresas").EnumerateArray());
        AssertContagem(e.GetProperty("documentosObra"), total: 2, pendentes: 1, emAnalise: 0, aprovados: 1, rejeitados: 0);
        AssertContagem(e.GetProperty("documentosGerais"), total: 2, pendentes: 1, emAnalise: 1, aprovados: 0, rejeitados: 0);
        Assert.Equal(2, e.GetProperty("quantidadeEnviosNaObra").GetInt32());
        Assert.Empty(detalhe.GetProperty("vinculosEncerrados").EnumerateArray());
    }

    [Fact]
    public async Task Detalhe_da_empresa_lista_obras_com_contagem_e_encerradas()
    {
        var ativa = await Semente.ObraAsync("Obra A");
        var encerrada = await Semente.ObraAsync("Obra B");
        var inativa = await Semente.ObraAsync("Obra C", ativa: false);
        var empresa = await Semente.EmpresaAsync();
        await Semente.VincularAsync(ativa, empresa);
        await Semente.VincularAsync(encerrada, empresa, encerrado: true);
        await Semente.VincularAsync(inativa, empresa);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(ativa, art);
        await Semente.MarcarAsync(encerrada, art);
        await Semente.EnvioObraAsync(encerrada, empresa, art, StatusEnvio.APROVADO);
        await Semente.TipoAsync();

        var j = await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}")).LerAsync();
        AssertContagem(j.GetProperty("documentos"), 1, 1, 0, 0, 0);
        Assert.Equal(JsonValueKind.Null, j.GetProperty("documentosObra").ValueKind);
        var obras = j.GetProperty("obras").EnumerateArray().ToList();
        Assert.Equal(new[] { "Obra A", "Obra B", "Obra C" }, obras.Select(o => o.Str("nome")));
        Assert.Equal(new[] { true, false, true }, obras.Select(o => o.GetProperty("vinculoAtivo").GetBoolean()));
        Assert.Equal(new[] { true, true, false }, obras.Select(o => o.GetProperty("obraAtiva").GetBoolean()));
        AssertContagem(obras[0].GetProperty("documentos"), 1, 1, 0, 0, 0);
        AssertContagem(obras[1].GetProperty("documentos"), 1, 0, 0, 1, 0);
        AssertContagem(obras[2].GetProperty("documentos"), 0, 0, 0, 0, 0);
        Assert.Equal("Aracaju", obras[0].Str("cidade"));
    }

    [Fact]
    public async Task Lista_de_empresas_traz_documentosObra_so_com_filtro_de_obra()
    {
        var obra = await Semente.ObraAsync();
        var vinculada = await Semente.EmpresaAsync("Alfa");
        var encerrada = await Semente.EmpresaAsync("Beta");
        await Semente.EmpresaAsync("Gama");
        await Semente.VincularAsync(obra, vinculada);
        await Semente.VincularAsync(obra, encerrada, encerrado: true);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        await Semente.EnvioObraAsync(obra, vinculada, art);
        var c = Fluig();

        var todas = (await (await c.GetAsync("/api/fluig/empresas")).LerAsync()).GetProperty("itens").EnumerateArray().ToList();
        Assert.Equal(3, todas.Count);
        Assert.All(todas, e => Assert.Equal(JsonValueKind.Null, e.GetProperty("documentosObra").ValueKind));

        var daObra = (await (await c.GetAsync($"/api/fluig/empresas?obraId={obra.Id}")).LerAsync()).GetProperty("itens").EnumerateArray().ToList();
        var unica = Assert.Single(daObra); // vínculo encerrado não entra no filtro
        Assert.Equal("Alfa", unica.Str("razaoSocial"));
        AssertContagem(unica.GetProperty("documentosObra"), 1, 0, 1, 0, 0);
        AssertContagem(unica.GetProperty("documentos"), 0, 0, 0, 0, 0);
    }

    [Fact]
    public async Task Documentos_e_historico_da_empresa_na_obra()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        await Semente.VincularAsync(obra, empresa);
        var art = await Semente.TipoPorObraAsync("ART da obra");
        var os = await Semente.TipoPorObraAsync("Ordem de serviço");
        var inativo = await Semente.TipoPorObraAsync("Inativo", ativo: false);
        await Semente.MarcarAsync(obra, art, os, inativo);
        var rej = await Semente.EnvioObraAsync(obra, empresa, art, StatusEnvio.REJEITADO);
        var vivo = await Semente.EnvioObraAsync(obra, empresa, art, StatusEnvio.EM_ANALISE);
        var geral = await Semente.TipoAsync("Cartão CNPJ");
        await Semente.EnvioAsync(empresa, geral);
        var c = Fluig();

        var docs = (await (await c.GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}/documentos")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal(new[] { "ART da obra", "Ordem de serviço" }, docs.Select(d => d.GetProperty("tipoDocumento").Str("nome")));
        Assert.Equal("EM_ANALISE", docs[0].Str("situacao"));
        Assert.Equal(2, docs[0].GetProperty("quantidadeEnvios").GetInt32());
        Assert.Equal(vivo.Id, docs[0].GetProperty("envioAtual").Id());
        Assert.Equal(obra.Id, docs[0].GetProperty("envioAtual").Id("obraId"));
        Assert.Equal("PENDENTE_ENVIO", docs[1].Str("situacao"));

        var hist = (await (await c.GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}/documentos/{art.Id}/envios")).LerAsync())
            .EnumerateArray().Select(e => e.Id()).ToList();
        Assert.Equal(new[] { vivo.Id, rej.Id }, hist);

        // Rotas gerais não misturam: só o geral; tipo POR_OBRA no histórico geral → 404.
        var gerais = (await (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal("Cartão CNPJ", Assert.Single(gerais).GetProperty("tipoDocumento").Str("nome"));
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos/{art.Id}/envios")).StatusCode);
        // Tipo GERAL na rota da obra → 404.
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}/documentos/{geral.Id}/envios")).StatusCode);
    }

    [Fact]
    public async Task Rotas_da_empresa_na_obra_404_sem_vinculo_e_respondem_com_vinculo_encerrado()
    {
        var obra = await Semente.ObraAsync();
        var semVinculo = await Semente.EmpresaAsync();
        var encerrada = await Semente.EmpresaAsync();
        await Semente.VincularAsync(obra, encerrada, encerrado: true);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        await Semente.EnvioObraAsync(obra, encerrada, art, StatusEnvio.APROVADO);
        var c = Fluig();

        foreach (var url in new[]
                 {
                     $"/api/fluig/obras/{obra.Id}/empresas/{semVinculo.Id}/documentos",
                     $"/api/fluig/obras/{obra.Id}/empresas/{semVinculo.Id}/documentos/{art.Id}/envios",
                     $"/api/fluig/obras/{Guid.NewGuid()}/empresas/{encerrada.Id}/documentos",
                     $"/api/fluig/obras/{obra.Id}/empresas/{encerrada.Id}/documentos/{Guid.NewGuid()}/envios",
                 })
        {
            var r = await c.GetAsync(url);
            Assert.True(r.StatusCode == HttpStatusCode.NotFound, $"{url} → {(int)r.StatusCode}");
            Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());
        }

        var docs = (await (await c.GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{encerrada.Id}/documentos")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal("APROVADO", Assert.Single(docs).Str("situacao"));
        Assert.Equal(1, (await (await c.GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{encerrada.Id}/documentos/{art.Id}/envios")).LerAsync()).GetArrayLength());
    }

    [Fact]
    public async Task Painel_e_lista_de_obras_com_pendencia_por_obra()
    {
        var art = await Semente.TipoPorObraAsync();
        // Obra 1: empresa pendente (nada enviado) → pendência.
        var o1 = await Semente.ObraAsync("Obra 1");
        var e1 = await Semente.EmpresaAsync();
        await Semente.VincularAsync(o1, e1);
        await Semente.MarcarAsync(o1, art);
        // Obra 2: empresa com aprovado → sem pendência.
        var o2 = await Semente.ObraAsync("Obra 2");
        var e2 = await Semente.EmpresaAsync();
        await Semente.VincularAsync(o2, e2);
        await Semente.MarcarAsync(o2, art);
        await Semente.EnvioObraAsync(o2, e2, art, StatusEnvio.APROVADO);
        // Obra 3: rejeitado → pendência.
        var o3 = await Semente.ObraAsync("Obra 3");
        await Semente.VincularAsync(o3, e2);
        await Semente.MarcarAsync(o3, art);
        await Semente.EnvioObraAsync(o3, e2, art, StatusEnvio.REJEITADO);
        // Obra 4: vínculo encerrado; Obra 5: inativa; Obra 6: empresa inativa → não contam.
        var o4 = await Semente.ObraAsync("Obra 4");
        await Semente.VincularAsync(o4, await Semente.EmpresaAsync(), encerrado: true);
        await Semente.MarcarAsync(o4, art);
        var o5 = await Semente.ObraAsync("Obra 5", ativa: false);
        await Semente.VincularAsync(o5, e1);
        await Semente.MarcarAsync(o5, art);
        var o6 = await Semente.ObraAsync("Obra 6");
        await Semente.VincularAsync(o6, await Semente.EmpresaAsync(ativa: false));
        await Semente.MarcarAsync(o6, art);
        // Empresa sem obra e sem tipos gerais pendentes.
        await Semente.EmpresaAsync();

        var c = Fluig();
        var painel = await (await c.GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(2, painel.GetProperty("obrasComPendencia").GetInt32());
        // e1 (obra 1) e e2 (obra 3) têm pendência só por obra.
        Assert.Equal(2, painel.GetProperty("empresasComPendencia").GetInt32());

        async Task<string[]> Nomes(string q) =>
            (await (await c.GetAsync("/api/fluig/obras" + q)).LerAsync()).GetProperty("itens").EnumerateArray().Select(o => o.Str("nome")).ToArray();
        Assert.Equal(new[] { "Obra 1", "Obra 3" }, await Nomes("?comPendencia=true"));
        Assert.Equal(new[] { "Obra 2", "Obra 4", "Obra 5", "Obra 6" }, await Nomes("?comPendencia=false"));

        var comPend = (await (await c.GetAsync("/api/fluig/empresas?comPendencia=true")).LerAsync()).GetProperty("itens").EnumerateArray()
            .Select(e => e.Id()).ToHashSet();
        Assert.Equal(new HashSet<Guid> { e1.Id, e2.Id }, comPend);

        // Enviar o que falta na obra 1 tira e1 e a obra 1 da pendência.
        await Semente.EnvioObraAsync(o1, e1, art);
        painel = await (await c.GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(1, painel.GetProperty("obrasComPendencia").GetInt32());
        Assert.Equal(1, painel.GetProperty("empresasComPendencia").GetInt32());
    }

    [Fact]
    public async Task Lista_de_obras_conta_so_vinculos_ativos()
    {
        var obra = await Semente.ObraAsync();
        await Semente.VincularAsync(obra, await Semente.EmpresaAsync());
        await Semente.VincularAsync(obra, await Semente.EmpresaAsync(), encerrado: true);
        var item = (await (await Fluig().GetAsync("/api/fluig/obras")).LerAsync()).GetProperty("itens")[0];
        Assert.Equal(1, item.GetProperty("quantidadeEmpresas").GetInt32());
        Assert.Equal(0, item.GetProperty("quantidadeTiposExigidos").GetInt32());
    }
}
