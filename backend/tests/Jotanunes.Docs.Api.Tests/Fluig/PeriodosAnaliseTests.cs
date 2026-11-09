using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Api.Tests.Fluig;

/// <summary>US3 (003): análise e acompanhamento por período na área Jotanunes.</summary>
public class PeriodosAnaliseTests(ApiFactory api) : TesteApi(api)
{
    private sealed record Cena(Empresa Empresa, TipoDocumento Guia, DateOnly Mes0);

    private static string Data(DateOnly d) => d.ToString("yyyy-MM-dd");

    /// <summary>Empresa antiga; "Guia do FGTS" geral mensal prazo 0 desde 3 meses atrás: 4 períodos, os 3 passados atrasados.</summary>
    private async Task<Cena> CenaAsync(string razao = "Alfa Serviços")
    {
        var empresa = await Semente.EmpresaAsync(razao, criadaEm: Semente.Agora.AddYears(-1));
        var mes0 = new DateOnly(Semente.Hoje.Year, Semente.Hoje.Month, 1);
        var guia = await Semente.TipoPeriodicoAsync("Guia do FGTS", Periodicidade.Meses(1, 0), Semente.MeioDia(mes0.AddMonths(-3).AddDays(4)));
        return new Cena(empresa, guia, mes0);
    }

    [Fact]
    public async Task Periodos_da_empresa_com_quem_analisou_e_quantidade()
    {
        var c = await CenaAsync();
        await Semente.EnvioAsync(c.Empresa, c.Guia, StatusEnvio.REJEITADO, "Valor errado", periodoInicio: c.Mes0.AddMonths(-1));
        await Semente.EnvioAsync(c.Empresa, c.Guia, StatusEnvio.APROVADO, periodoInicio: c.Mes0.AddMonths(-1));
        var r = await Fluig().GetAsync($"/api/fluig/empresas/{c.Empresa.Id}/documentos/{c.Guia.Id}/periodos");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var ps = (await r.LerAsync()).EnumerateArray().ToList();
        Assert.Equal(4, ps.Count);
        Assert.Equal(Data(c.Mes0), ps[0].Str("inicio"));
        var anterior = ps[1];
        Assert.Equal("APROVADO", anterior.Str("situacao"));
        Assert.False(anterior.GetProperty("atrasado").GetBoolean());
        Assert.Equal(2, anterior.GetProperty("quantidadeEnvios").GetInt32());
        Assert.Equal("analista", anterior.GetProperty("envioAtual").GetProperty("analisadoPor").Str("login"));
        Assert.True(anterior.GetProperty("envioAtual").GetProperty("enviadoComAtraso").GetBoolean());
        Assert.Equal(new[] { false, false, true, true }, ps.Select(p => p.GetProperty("atrasado").GetBoolean()));
        Assert.All(ps, p => Assert.True(p.TryGetProperty("prazo", out _)));

        // Documentos da empresa: situação resumida e resumo.
        var doc = Assert.Single((await (await Fluig().GetAsync($"/api/fluig/empresas/{c.Empresa.Id}/documentos")).LerAsync()).EnumerateArray());
        Assert.True(doc.GetProperty("atrasado").GetBoolean());
        Assert.Equal("PENDENTE_ENVIO", doc.Str("situacao"));
        Assert.Equal(2, doc.GetProperty("quantidadeEnvios").GetInt32());
        Assert.Equal(2, doc.GetProperty("periodos").GetProperty("atrasados").GetInt32());
        Assert.Equal(1, doc.GetProperty("periodos").GetProperty("aprovados").GetInt32());

        // Histórico filtrado pelo período.
        var hist = await Fluig().GetAsync($"/api/fluig/empresas/{c.Empresa.Id}/documentos/{c.Guia.Id}/envios?periodoInicio={Data(c.Mes0.AddMonths(-1))}");
        Assert.Equal(2, (await hist.LerAsync()).GetArrayLength());
        var outro = await Fluig().GetAsync($"/api/fluig/empresas/{c.Empresa.Id}/documentos/{c.Guia.Id}/envios?periodoInicio={Data(c.Mes0)}");
        Assert.Equal(0, (await outro.LerAsync()).GetArrayLength());
    }

    [Fact]
    public async Task Periodos_404_para_tipo_unico_por_obra_ou_empresa_inexistente()
    {
        var c = await CenaAsync();
        var unico = await Semente.TipoAsync("Cartão CNPJ");
        var porObra = await Semente.TipoPeriodicoAsync("Relatório da obra", Periodicidade.Meses(1, 5), abrangencia: Abrangencia.POR_OBRA);
        var f = Fluig();
        Assert.Equal(HttpStatusCode.NotFound, (await f.GetAsync($"/api/fluig/empresas/{c.Empresa.Id}/documentos/{unico.Id}/periodos")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await f.GetAsync($"/api/fluig/empresas/{c.Empresa.Id}/documentos/{porObra.Id}/periodos")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await f.GetAsync($"/api/fluig/empresas/{Guid.NewGuid()}/documentos/{c.Guia.Id}/periodos")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Anonimo().GetAsync($"/api/fluig/empresas/{c.Empresa.Id}/documentos/{c.Guia.Id}/periodos")).StatusCode);
    }

    [Fact]
    public async Task Periodos_da_obra_inclusive_com_vinculo_encerrado()
    {
        var empresa = await Semente.EmpresaAsync(criadaEm: Semente.Agora.AddYears(-1));
        var hoje = Semente.Hoje;
        var obra = await Semente.ObraAsync();
        var tipo = await Semente.TipoPeriodicoAsync("Relatório decendial", Periodicidade.Dias(10, 3), Semente.MeioDia(hoje.AddDays(-40)), Abrangencia.POR_OBRA);
        await Semente.MarcarEmAsync(obra, Semente.MeioDia(hoje.AddDays(-30)), tipo);
        await Semente.VincularAsync(obra, empresa, em: Semente.MeioDia(hoje.AddDays(-25)));
        var url = $"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}/documentos/{tipo.Id}/periodos";
        var ps = (await (await Fluig().GetAsync(url)).LerAsync()).EnumerateArray().ToList();
        Assert.Equal(new[] { -5, -15, -25 }.Select(k => Data(hoje.AddDays(k))), ps.Select(p => p.Str("inicio")));

        // Contagem na obra: um documento, pendente, 2 períodos atrasados.
        var detalhe = await (await Fluig().GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync();
        var naObra = Assert.Single(detalhe.GetProperty("empresas").EnumerateArray()).GetProperty("documentosObra");
        Assert.Equal((1, 1, 2), (naObra.GetProperty("total").GetInt32(), naObra.GetProperty("pendentes").GetInt32(), naObra.GetProperty("periodosAtrasados").GetInt32()));

        // Encerrar o vínculo: a lista continua respondendo (histórico).
        Assert.Equal(HttpStatusCode.NoContent, (await Fluig().DeleteAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}")).StatusCode);
        Assert.Equal(3, (await (await Fluig().GetAsync(url)).LerAsync()).GetArrayLength());

        // Tipo não marcado em outra obra com vínculo → 404; sem vínculo → 404.
        var outra = await Semente.ObraAsync();
        await Semente.VincularAsync(outra, empresa);
        Assert.Equal(HttpStatusCode.NotFound, (await Fluig().GetAsync($"/api/fluig/obras/{outra.Id}/empresas/{empresa.Id}/documentos/{tipo.Id}/periodos")).StatusCode);
        var semVinculo = await Semente.EmpresaAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await Fluig().GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{semVinculo.Id}/documentos/{tipo.Id}/periodos")).StatusCode);
    }

    [Fact]
    public async Task Fila_e_detalhe_mostram_periodo_e_filtram_com_atraso()
    {
        var c = await CenaAsync();
        var atrasado = await Semente.EnvioAsync(c.Empresa, c.Guia, periodoInicio: c.Mes0.AddMonths(-2));
        var emDia = await Semente.EnvioAsync(c.Empresa, c.Guia, periodoInicio: c.Mes0);
        var unico = await Semente.TipoAsync("Cartão CNPJ");
        await Semente.EnvioAsync(c.Empresa, unico);

        var fila = (await (await Fluig().GetAsync("/api/fluig/envios")).LerAsync()).GetProperty("itens").EnumerateArray().ToList();
        Assert.Equal(3, fila.Count);
        var linha = fila.Single(e => e.Id() == atrasado.Id);
        Assert.True(linha.GetProperty("enviadoComAtraso").GetBoolean());
        Assert.Equal(Data(c.Mes0.AddMonths(-2)), linha.GetProperty("periodo").Str("inicio"));
        Assert.Equal("MESES", linha.GetProperty("tipoDocumento").GetProperty("periodicidade").Str("unidade"));
        Assert.False(fila.Single(e => e.Id() == emDia.Id).GetProperty("enviadoComAtraso").GetBoolean());
        Assert.Equal(JsonValueKind.Null, fila.Single(e => e.GetProperty("tipoDocumento").Str("nome") == "Cartão CNPJ").GetProperty("periodo").ValueKind);

        var comAtraso = (await (await Fluig().GetAsync("/api/fluig/envios?comAtraso=true")).LerAsync()).GetProperty("itens").EnumerateArray().ToList();
        Assert.Equal(atrasado.Id, Assert.Single(comAtraso).Id());

        var detalhe = await (await Fluig().GetAsync($"/api/fluig/envios/{atrasado.Id}")).LerAsync();
        Assert.Equal(linha.GetProperty("periodo").Str("rotulo"), detalhe.GetProperty("periodo").Str("rotulo"));
    }

    [Fact]
    public async Task Rejeicao_de_envio_periodico_cita_o_periodo_no_email()
    {
        var c = await CenaAsync();
        var envio = await Semente.EnvioAsync(c.Empresa, c.Guia, periodoInicio: c.Mes0.AddMonths(-1));
        var r = await Fluig().PostAsJsonAsync($"/api/fluig/envios/{envio.Id}/rejeitar", new { motivo = "Valor do recolhimento errado" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var rotulo = (await r.LerAsync()).GetProperty("periodo").Str("rotulo");
        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Contains($"({rotulo})", email.Assunto);
        Assert.Contains($"do período {rotulo}", email.Texto);
        Assert.Contains($"/documentos/{c.Guia.Id}/periodos", email.Texto);

        var outro = await Semente.EnvioAsync(c.Empresa, c.Guia, periodoInicio: c.Mes0);
        var aprovado = await Fluig().PostAsync($"/api/fluig/envios/{outro.Id}/aprovar", null);
        Assert.Equal(HttpStatusCode.OK, aprovado.StatusCode);
        Assert.Equal(Data(c.Mes0), (await aprovado.LerAsync()).GetProperty("periodo").Str("inicio"));
    }

    [Fact]
    public async Task Contagens_empresas_com_atraso_pendencia_e_painel()
    {
        var c = await CenaAsync("Alfa Serviços");
        // Beta: todos os períodos aprovados → sem atraso nem pendência.
        var beta = await Semente.EmpresaAsync("Beta Obras", criadaEm: Semente.Agora.AddYears(-1));
        for (var k = -3; k <= 0; k++) await Semente.EnvioAsync(beta, c.Guia, StatusEnvio.APROVADO, periodoInicio: c.Mes0.AddMonths(k));
        // Gama: só o período em curso enviado → os 3 passados atrasados (o envio "vivo" de um período não esconde os outros).
        var gama = await Semente.EmpresaAsync("Gama Limpeza", criadaEm: Semente.Agora.AddYears(-1));
        await Semente.EnvioAsync(gama, c.Guia, StatusEnvio.APROVADO, periodoInicio: c.Mes0);

        var lista = (await (await Fluig().GetAsync("/api/fluig/empresas")).LerAsync()).GetProperty("itens").EnumerateArray()
            .ToDictionary(e => e.Str("razaoSocial"), e => e.GetProperty("documentos"));
        Assert.Equal((1, 1, 3), (lista["Alfa Serviços"].GetProperty("total").GetInt32(), lista["Alfa Serviços"].GetProperty("pendentes").GetInt32(),
            lista["Alfa Serviços"].GetProperty("periodosAtrasados").GetInt32()));
        Assert.Equal((1, 0), (lista["Beta Obras"].GetProperty("aprovados").GetInt32(), lista["Beta Obras"].GetProperty("periodosAtrasados").GetInt32()));
        Assert.Equal((1, 3), (lista["Gama Limpeza"].GetProperty("pendentes").GetInt32(), lista["Gama Limpeza"].GetProperty("periodosAtrasados").GetInt32()));

        async Task<string[]> Nomes(string q) => (await (await Fluig().GetAsync("/api/fluig/empresas" + q)).LerAsync()).GetProperty("itens")
            .EnumerateArray().Select(e => e.Str("razaoSocial")).ToArray();
        Assert.Equal(new[] { "Alfa Serviços", "Gama Limpeza" }, await Nomes("?comAtraso=true"));
        Assert.Equal(new[] { "Alfa Serviços", "Gama Limpeza" }, await Nomes("?comPendencia=true"));
        Assert.Equal(new[] { "Beta Obras" }, await Nomes("?comPendencia=false"));
        Assert.Equal(new[] { "Alfa Serviços", "Beta Obras", "Gama Limpeza" }, await Nomes("?comAtraso=false"));

        var painel = await (await Fluig().GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(2, painel.GetProperty("empresasComAtraso").GetInt32());
        Assert.Equal(2, painel.GetProperty("empresasComPendencia").GetInt32());

        var detalhe = await (await Fluig().GetAsync($"/api/fluig/empresas/{gama.Id}")).LerAsync();
        Assert.Equal(3, detalhe.GetProperty("documentos").GetProperty("periodosAtrasados").GetInt32());
    }

    [Fact]
    public async Task Periodo_atual_pendente_no_prazo_conta_como_pendencia_mas_nao_atraso()
    {
        // Tipo criado agora: só o período em curso, no prazo.
        var empresa = await Semente.EmpresaAsync("Delta", criadaEm: Semente.Agora.AddYears(-1));
        await Semente.TipoPeriodicoAsync("Guia do FGTS", Periodicidade.Meses(1, 15));
        var painel = await (await Fluig().GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(0, painel.GetProperty("empresasComAtraso").GetInt32());
        Assert.Equal(1, painel.GetProperty("empresasComPendencia").GetInt32());
        var doc = Assert.Single((await (await Fluig().GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos")).LerAsync()).EnumerateArray());
        Assert.False(doc.GetProperty("atrasado").GetBoolean());
        Assert.Equal(1, doc.GetProperty("periodos").GetProperty("pendentes").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, doc.GetProperty("periodos").GetProperty("proximo").ValueKind);
    }

    [Fact]
    public async Task Obra_com_pendencia_periodica()
    {
        var empresa = await Semente.EmpresaAsync(criadaEm: Semente.Agora.AddYears(-1));
        var obra = await Semente.ObraAsync("Obra Periódica");
        var tipo = await Semente.TipoPeriodicoAsync("Relatório da obra", Periodicidade.Meses(1, 10), abrangencia: Abrangencia.POR_OBRA);
        await Semente.MarcarAsync(obra, tipo);
        await Semente.VincularAsync(obra, empresa);
        var com = (await (await Fluig().GetAsync("/api/fluig/obras?comPendencia=true")).LerAsync()).GetProperty("itens").EnumerateArray();
        Assert.Equal("Obra Periódica", Assert.Single(com).Str("nome"));

        await Semente.EnvioObraAsync(obra, empresa, tipo, StatusEnvio.APROVADO, periodoInicio: new DateOnly(Semente.Hoje.Year, Semente.Hoje.Month, 1));
        Assert.Equal(0, (await (await Fluig().GetAsync("/api/fluig/obras?comPendencia=true")).LerAsync()).GetProperty("itens").GetArrayLength());
    }
}
