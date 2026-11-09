using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Portal;

/// <summary>
/// US2 (003): a empresa envia o arquivo de cada período pelo portal. Datas relativas ao relógio falso; prazo 0 (mensal) e
/// blocos de dias deixam o "atrasado" independente do dia em que o teste roda.
/// </summary>
public class PeriodosPortalTests(ApiFactory api) : TesteApi(api)
{
    private sealed record Cena(Empresa Empresa, HttpClient Cliente, TipoDocumento Guia, DateOnly Mes0);

    private static string Data(DateOnly d) => d.ToString("yyyy-MM-dd");

    /// <summary>"Guia do FGTS" geral mensal, prazo 0, cobrada desde o dia 5 de três meses atrás: 4 períodos, 3 atrasados.</summary>
    private async Task<Cena> CenaAsync()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync(criadaEm: Semente.Agora.AddYears(-1));
        var mes0 = new DateOnly(Semente.Hoje.Year, Semente.Hoje.Month, 1);
        var guia = await Semente.TipoPeriodicoAsync("Guia do FGTS", Periodicidade.Meses(1, 0), Semente.MeioDia(mes0.AddMonths(-3).AddDays(4)));
        return new Cena(empresa, Api.Cliente(token: token), guia, mes0);
    }

    private static MultipartFormDataContent Form(DateOnly? periodo, string? texto = null)
    {
        var form = ArquivosTeste.Form(ArquivosTeste.Pdf(), "guia.pdf");
        if (periodo is not null || texto is not null) form.Add(new StringContent(texto ?? Data(periodo!.Value)), "periodoInicio");
        return form;
    }

    private static string Envios(TipoDocumento t) => $"/api/portal/documentos/{t.Id}/envios";

    private async Task<List<JsonElement>> PeriodosAsync(HttpClient c, string url)
    {
        var r = await c.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return (await r.LerAsync()).EnumerateArray().ToList();
    }

    [Fact]
    public async Task Lista_periodos_do_mais_recente_ao_mais_antigo_com_atraso()
    {
        var c = await CenaAsync();
        var ps = await PeriodosAsync(c.Cliente, $"/api/portal/documentos/{c.Guia.Id}/periodos");
        Assert.Equal(new[] { 0, -1, -2, -3 }.Select(k => Data(c.Mes0.AddMonths(k))), ps.Select(p => p.Str("inicio")));
        Assert.Equal(new[] { false, true, true, true }, ps.Select(p => p.GetProperty("atrasado").GetBoolean()));
        Assert.All(ps, p => Assert.Equal("PENDENTE_ENVIO", p.Str("situacao")));
        Assert.All(ps, p => Assert.True(p.GetProperty("podeEnviar").GetBoolean()));
        Assert.All(ps, p => Assert.Equal(JsonValueKind.Null, p.GetProperty("envioAtual").ValueKind));
        var atual = ps[0];
        Assert.Equal(Data(c.Mes0.AddMonths(1).AddDays(-1)), atual.Str("fim"));
        Assert.Equal(atual.Str("fim"), atual.Str("prazo")); // prazo 0
        Assert.Matches(@"^\p{Lu}\p{Ll}+/\d{4}$", atual.Str("rotulo"));
    }

    [Fact]
    public async Task Envio_por_periodo_muda_so_aquele_periodo_e_marca_atraso()
    {
        var c = await CenaAsync();
        var fevereiroQualquer = c.Mes0.AddMonths(-2);
        var r = await c.Cliente.PostAsync(Envios(c.Guia), Form(fevereiroQualquer));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var envio = await r.LerAsync();
        Assert.True(envio.GetProperty("enviadoComAtraso").GetBoolean());
        Assert.Equal(Data(fevereiroQualquer), envio.GetProperty("periodo").Str("inicio"));
        Assert.Equal(Data(c.Mes0.AddMonths(-1).AddDays(-1)), envio.GetProperty("periodo").Str("fim"));
        var salvo = await Api.NoBancoAsync(db => db.Envios.AsNoTracking().SingleAsync());
        Assert.Equal(fevereiroQualquer, salvo.PeriodoInicio);
        Assert.True(salvo.EnviadoComAtraso);

        var ps = await PeriodosAsync(c.Cliente, $"/api/portal/documentos/{c.Guia.Id}/periodos");
        Assert.Equal(new[] { "PENDENTE_ENVIO", "PENDENTE_ENVIO", "EM_ANALISE", "PENDENTE_ENVIO" }, ps.Select(p => p.Str("situacao")));
        Assert.False(ps[2].GetProperty("atrasado").GetBoolean());
        Assert.False(ps[2].GetProperty("podeEnviar").GetBoolean());
        Assert.Equal(salvo.Id, ps[2].GetProperty("envioAtual").Id());

        // Cartão: situação resumida (atrasado primeiro), contagens e próximo período.
        var doc = Assert.Single((await (await c.Cliente.GetAsync("/api/portal/documentos")).LerAsync()).EnumerateArray());
        Assert.Equal("PENDENTE_ENVIO", doc.Str("situacao"));
        Assert.True(doc.GetProperty("atrasado").GetBoolean());
        Assert.True(doc.GetProperty("podeEnviar").GetBoolean());
        var resumo = doc.GetProperty("periodos");
        Assert.Equal((2, 3, 0, 1, 0), (resumo.GetProperty("atrasados").GetInt32(), resumo.GetProperty("pendentes").GetInt32(),
            resumo.GetProperty("rejeitados").GetInt32(), resumo.GetProperty("emAnalise").GetInt32(), resumo.GetProperty("aprovados").GetInt32()));
        Assert.Equal(Data(c.Mes0.AddMonths(-3)), resumo.GetProperty("proximo").Str("inicio"));
        Assert.Equal("Mensal · até o último dia do período", doc.GetProperty("tipoDocumento").GetProperty("periodicidade").Str("descricao"));
    }

    [Fact]
    public async Task Envio_do_periodo_em_curso_nao_e_atrasado()
    {
        var c = await CenaAsync();
        var r = await c.Cliente.PostAsync(Envios(c.Guia), Form(c.Mes0));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.False((await r.LerAsync()).GetProperty("enviadoComAtraso").GetBoolean());
    }

    [Fact]
    public async Task Periodo_invalido_ou_ausente_e_recusado()
    {
        var c = await CenaAsync();
        async Task Espera(HttpStatusCode status, string codigo, MultipartFormDataContent form)
        {
            var r = await c.Cliente.PostAsync(Envios(c.Guia), form);
            Assert.Equal(status, r.StatusCode);
            Assert.Equal(codigo, await r.CodigoAsync());
        }
        await Espera(HttpStatusCode.NotFound, "NAO_ENCONTRADO", Form(c.Mes0.AddMonths(1)));          // futuro
        await Espera(HttpStatusCode.NotFound, "NAO_ENCONTRADO", Form(c.Mes0.AddMonths(-4)));         // antes do início
        await Espera(HttpStatusCode.NotFound, "NAO_ENCONTRADO", Form(c.Mes0.AddMonths(-2).AddDays(1))); // não é início
        await Espera(HttpStatusCode.BadRequest, "PERIODO_OBRIGATORIO", Form(null));
        await Espera(HttpStatusCode.BadRequest, "VALIDACAO", Form(null, "01/10/2026"));

        var unico = await Semente.TipoAsync("Cartão CNPJ");
        var r = await c.Cliente.PostAsync(Envios(unico), Form(c.Mes0));
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("PERIODO_OBRIGATORIO", await r.CodigoAsync());
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Envios.CountAsync()));
        // Tipo único sem período: como antes.
        Assert.Equal(HttpStatusCode.Created, (await c.Cliente.PostAsync(Envios(unico), Form(null))).StatusCode);
    }

    [Fact]
    public async Task Um_vivo_por_periodo_e_periodos_diferentes_aceitos()
    {
        var c = await CenaAsync();
        Assert.Equal(HttpStatusCode.Created, (await c.Cliente.PostAsync(Envios(c.Guia), Form(c.Mes0.AddMonths(-1)))).StatusCode);
        var dup = await c.Cliente.PostAsync(Envios(c.Guia), Form(c.Mes0.AddMonths(-1)));
        Assert.Equal(HttpStatusCode.Conflict, dup.StatusCode);
        Assert.Equal("ENVIO_NAO_PERMITIDO", await dup.CodigoAsync());
        Assert.Equal(HttpStatusCode.Created, (await c.Cliente.PostAsync(Envios(c.Guia), Form(c.Mes0.AddMonths(-3)))).StatusCode);

        // Duas abas no mesmo período ao mesmo tempo: só uma aceita.
        var respostas = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => c.Cliente.PostAsync(Envios(c.Guia), Form(c.Mes0))));
        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(3, await Api.NoBancoAsync(db => db.Envios.CountAsync()));
    }

    [Fact]
    public async Task Rejeitado_pode_reenviar_e_historico_filtra_por_periodo()
    {
        var c = await CenaAsync();
        var periodo = c.Mes0.AddMonths(-1);
        await Semente.EnvioAsync(c.Empresa, c.Guia, StatusEnvio.REJEITADO, "Valor errado", periodoInicio: periodo);
        await Semente.EnvioAsync(c.Empresa, c.Guia, StatusEnvio.APROVADO, periodoInicio: c.Mes0);
        var ps = await PeriodosAsync(c.Cliente, $"/api/portal/documentos/{c.Guia.Id}/periodos");
        Assert.Equal("REJEITADO", ps[1].Str("situacao"));
        Assert.True(ps[1].GetProperty("atrasado").GetBoolean());
        Assert.Equal("Valor errado", ps[1].GetProperty("envioAtual").Str("motivoRejeicao"));
        Assert.Equal("APROVADO", ps[0].Str("situacao"));

        Assert.Equal(HttpStatusCode.Created, (await c.Cliente.PostAsync(Envios(c.Guia), Form(periodo))).StatusCode);
        var historico = (await (await c.Cliente.GetAsync($"{Envios(c.Guia)}?periodoInicio={Data(periodo)}")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal(2, historico.Count);
        Assert.All(historico, e => Assert.Equal(Data(periodo), e.GetProperty("periodo").Str("inicio")));
        Assert.Equal(3, (await (await c.Cliente.GetAsync(Envios(c.Guia))).LerAsync()).GetArrayLength());
    }

    [Fact]
    public async Task Periodos_da_obra_desde_o_vinculo_e_envio_por_obra()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync(criadaEm: Semente.Agora.AddYears(-1));
        var cliente = Api.Cliente(token: token);
        var hoje = Semente.Hoje;
        var obra = await Semente.ObraAsync("Obra Alfa");
        // A cada 10 dias, prazo 3: início = vínculo (o mais recente dos marcos) → períodos hoje-25, hoje-15, hoje-5.
        var tipo = await Semente.TipoPeriodicoAsync("Relatório decendial", Periodicidade.Dias(10, 3), Semente.MeioDia(hoje.AddDays(-40)), Abrangencia.POR_OBRA);
        await Semente.MarcarEmAsync(obra, Semente.MeioDia(hoje.AddDays(-30)), tipo);
        await Semente.VincularAsync(obra, empresa, em: Semente.MeioDia(hoje.AddDays(-25)));

        var ps = await PeriodosAsync(cliente, $"/api/portal/obras/{obra.Id}/documentos/{tipo.Id}/periodos");
        Assert.Equal(new[] { -5, -15, -25 }.Select(k => Data(hoje.AddDays(k))), ps.Select(p => p.Str("inicio")));
        Assert.Equal(new[] { false, true, true }, ps.Select(p => p.GetProperty("atrasado").GetBoolean()));
        Assert.StartsWith(hoje.AddDays(-25).ToString("dd'/'MM"), ps[2].Str("rotulo"));

        var url = $"/api/portal/obras/{obra.Id}/documentos/{tipo.Id}/envios";
        Assert.Equal(HttpStatusCode.Created, (await cliente.PostAsync(url, Form(hoje.AddDays(-15)))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await cliente.PostAsync(url, Form(hoje.AddDays(5)))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await cliente.PostAsync(url, Form(null))).StatusCode);

        var doc = Assert.Single((await (await cliente.GetAsync($"/api/portal/obras/{obra.Id}/documentos")).LerAsync()).EnumerateArray());
        Assert.True(doc.GetProperty("atrasado").GetBoolean());
        Assert.Equal(1, doc.GetProperty("periodos").GetProperty("atrasados").GetInt32());
        var obras = Assert.Single((await (await cliente.GetAsync("/api/portal/obras")).LerAsync()).EnumerateArray());
        Assert.Equal(1, obras.GetProperty("documentos").GetProperty("periodosAtrasados").GetInt32());
        Assert.Equal(1, obras.GetProperty("documentos").GetProperty("pendentes").GetInt32());
    }

    [Fact]
    public async Task Isolamento_entre_empresas_e_obras()
    {
        var c = await CenaAsync();
        // Outra empresa, cadastrada agora: só o período em curso, dela.
        var (outra, tokenOutra) = await Semente.EmpresaComAcessoAsync();
        await Semente.EnvioAsync(c.Empresa, c.Guia, periodoInicio: c.Mes0);
        var daOutra = await PeriodosAsync(Api.Cliente(token: tokenOutra), $"/api/portal/documentos/{c.Guia.Id}/periodos");
        var unico = Assert.Single(daOutra);
        Assert.Equal("PENDENTE_ENVIO", unico.Str("situacao"));

        var obra = await Semente.ObraAsync();
        var tipoObra = await Semente.TipoPeriodicoAsync("Relatório da obra", Periodicidade.Meses(1, 10), abrangencia: Abrangencia.POR_OBRA);
        await Semente.MarcarAsync(obra, tipoObra);
        await Semente.VincularAsync(obra, outra);
        // Sem vínculo → 404 nas rotas da obra.
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.GetAsync($"/api/portal/obras/{obra.Id}/documentos/{tipoObra.Id}/periodos")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.PostAsync($"/api/portal/obras/{obra.Id}/documentos/{tipoObra.Id}/envios", Form(c.Mes0))).StatusCode);
        // Tipo POR_OBRA na rota geral e tipo único → 404.
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.GetAsync($"/api/portal/documentos/{tipoObra.Id}/periodos")).StatusCode);
        var cartao = await Semente.TipoAsync("Cartão CNPJ");
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.GetAsync($"/api/portal/documentos/{cartao.Id}/periodos")).StatusCode);
        // Vínculo encerrado → 404.
        var encerrada = await Semente.ObraAsync();
        await Semente.MarcarAsync(encerrada, tipoObra);
        await Semente.VincularAsync(encerrada, c.Empresa, encerrado: true);
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.GetAsync($"/api/portal/obras/{encerrada.Id}/documentos/{tipoObra.Id}/periodos")).StatusCode);
        // Sem token → 401.
        Assert.Equal(HttpStatusCode.Unauthorized, (await Anonimo().GetAsync($"/api/portal/documentos/{c.Guia.Id}/periodos")).StatusCode);
    }
}
