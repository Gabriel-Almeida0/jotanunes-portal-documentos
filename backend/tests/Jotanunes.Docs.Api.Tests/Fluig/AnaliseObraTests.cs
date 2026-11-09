using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Api.Tests.Fluig;

/// <summary>US3 (002): análise com a obra no contexto (fila, detalhe, e-mail de rejeição).</summary>
public class AnaliseObraTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Fila_mostra_a_obra_e_filtra_por_obra_e_somente_gerais()
    {
        var a = await Semente.ObraAsync("Obra Alfa");
        var b = await Semente.ObraAsync("Obra Beta");
        var empresa = await Semente.EmpresaAsync("Construtora X");
        await Semente.VincularAsync(a, empresa);
        await Semente.VincularAsync(b, empresa);
        var art = await Semente.TipoPorObraAsync("ART da obra");
        var geral = await Semente.TipoAsync("Cartão CNPJ");
        var ea = await Semente.EnvioObraAsync(a, empresa, art);
        var eb = await Semente.EnvioObraAsync(b, empresa, art);
        var eg = await Semente.EnvioAsync(empresa, geral);

        var c = Fluig();
        var fila = (await (await c.GetAsync("/api/fluig/envios")).LerAsync()).GetProperty("itens").EnumerateArray().ToList();
        Assert.Equal(new[] { ea.Id, eb.Id, eg.Id }, fila.Select(i => i.Id()));
        var obra = fila[0].GetProperty("obra");
        Assert.Equal(a.Id, obra.Id());
        Assert.Equal("Obra Alfa", obra.Str("nome"));
        Assert.Equal("Aracaju", obra.Str("cidade"));
        Assert.Equal("SE", obra.Str("uf"));
        Assert.Equal(a.Id, fila[0].Id("obraId"));
        Assert.Equal("POR_OBRA", fila[0].GetProperty("tipoDocumento").Str("abrangencia"));
        Assert.Equal(JsonValueKind.Null, fila[2].GetProperty("obra").ValueKind);
        Assert.Equal(JsonValueKind.Null, fila[2].GetProperty("obraId").ValueKind);

        async Task<Guid[]> Ids(string q) => (await (await c.GetAsync("/api/fluig/envios?" + q)).LerAsync()).GetProperty("itens").EnumerateArray().Select(i => i.Id()).ToArray();
        Assert.Equal(new[] { ea.Id }, await Ids($"obraId={a.Id}"));
        Assert.Equal(new[] { eb.Id }, await Ids($"obraId={b.Id}"));
        Assert.Equal(new[] { eg.Id }, await Ids("somenteGerais=true"));
        Assert.Equal(3, (await Ids("somenteGerais=false")).Length);

        var ambos = await c.GetAsync($"/api/fluig/envios?obraId={a.Id}&somenteGerais=true");
        Assert.Equal(HttpStatusCode.BadRequest, ambos.StatusCode);
        Assert.Equal("VALIDACAO", await ambos.CodigoAsync());

        var detalhe = await (await c.GetAsync($"/api/fluig/envios/{eb.Id}")).LerAsync();
        Assert.Equal(b.Id, detalhe.GetProperty("obra").Id());
        Assert.Equal(b.Id, detalhe.Id("obraId"));
    }

    [Fact]
    public async Task Rejeitar_na_obra_A_nao_muda_a_obra_B_e_email_cita_a_obra()
    {
        var a = await Semente.ObraAsync("Residencial Mar Azul");
        var b = await Semente.ObraAsync("Obra Beta");
        var empresa = await Semente.EmpresaAsync("Construtora X", email: "contato@x.test");
        await Semente.VincularAsync(a, empresa);
        await Semente.VincularAsync(b, empresa);
        var art = await Semente.TipoPorObraAsync("ART da obra");
        await Semente.MarcarAsync(a, art);
        await Semente.MarcarAsync(b, art);
        var ea = await Semente.EnvioObraAsync(a, empresa, art);
        var eb = await Semente.EnvioObraAsync(b, empresa, art);

        var c = Fluig();
        var r = await c.PostAsJsonAsync($"/api/fluig/envios/{ea.Id}/rejeitar", new { motivo = "Falta a assinatura do responsável" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal(a.Id, (await r.LerAsync()).Id("obraId"));

        var docsA = (await (await c.GetAsync($"/api/fluig/obras/{a.Id}/empresas/{empresa.Id}/documentos")).LerAsync())[0];
        var docsB = (await (await c.GetAsync($"/api/fluig/obras/{b.Id}/empresas/{empresa.Id}/documentos")).LerAsync())[0];
        Assert.Equal("REJEITADO", docsA.Str("situacao"));
        Assert.Equal("EM_ANALISE", docsB.Str("situacao"));
        Assert.Equal(eb.Id, docsB.GetProperty("envioAtual").Id());

        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Equal("contato@x.test", email.Para);
        Assert.Contains("na obra Residencial Mar Azul", email.Texto);
        Assert.Contains($"{ApiFactory.PortalBaseUrl}/obras/{a.Id}", email.Texto);
        Assert.Contains("Residencial Mar Azul", email.Assunto);
    }

    [Fact]
    public async Task Rejeitar_documento_geral_continua_com_link_de_documentos()
    {
        var empresa = await Semente.EmpresaAsync();
        var geral = await Semente.TipoAsync("Cartão CNPJ");
        var envio = await Semente.EnvioAsync(empresa, geral);
        await Fluig().PostAsJsonAsync($"/api/fluig/envios/{envio.Id}/rejeitar", new { motivo = "Documento ilegível" });
        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.DoesNotContain("na obra", email.Texto);
        Assert.Contains($"{ApiFactory.PortalBaseUrl}/documentos", email.Texto);
    }

    [Fact]
    public async Task Decisao_aceita_mesmo_sem_o_documento_ser_mais_exigido()
    {
        // FR-231: envio EM_ANALISE pode ser decidido com vínculo encerrado, obra inativa ou tipo desmarcado.
        var empresa = await Semente.EmpresaAsync();
        var art = await Semente.TipoPorObraAsync();
        var encerrada = await Semente.ObraAsync();
        await Semente.VincularAsync(encerrada, empresa, encerrado: true);
        var inativa = await Semente.ObraAsync(ativa: false);
        await Semente.VincularAsync(inativa, empresa);
        var desmarcada = await Semente.ObraAsync();
        await Semente.VincularAsync(desmarcada, empresa); // tipo nunca marcado/desmarcado
        var e1 = await Semente.EnvioObraAsync(encerrada, empresa, art);
        var e2 = await Semente.EnvioObraAsync(inativa, empresa, art);
        var e3 = await Semente.EnvioObraAsync(desmarcada, empresa, art);

        var c = Fluig();
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync($"/api/fluig/envios/{e1.Id}/aprovar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"/api/fluig/envios/{e2.Id}/rejeitar", new { motivo = "Documento vencido" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync($"/api/fluig/envios/{e3.Id}/aprovar", null)).StatusCode);
        Assert.Equal(StatusEnvio.APROVADO, (await Api.NoBancoAsync(db => Task.FromResult(db.Envios.Single(e => e.Id == e1.Id)))).Status);
    }
}
