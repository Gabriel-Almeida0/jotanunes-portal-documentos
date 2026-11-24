using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Api.Tests.Fluig;

public class PainelTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Indicadores_batem_com_o_cenario()
    {
        await Semente.ObraAsync();
        await Semente.ObraAsync();
        await Semente.ObraAsync(ativa: false);
        var t1 = await Semente.TipoAsync();
        var t2 = await Semente.TipoAsync();
        await Semente.TipoAsync(ativo: false);

        // completa: tudo aprovado/em análise → sem pendência; ATIVA
        var (completa, _) = await Semente.EmpresaComAcessoAsync("Completa");
        await Semente.EnvioAsync(completa, t1, StatusEnvio.APROVADO);
        await Semente.EnvioAsync(completa, t2);
        // com rejeitado → pendência; CONVIDADA
        var convidada = await Semente.EmpresaAsync("Convidada");
        await FluxoConvite.ConvidarAsync(Api, convidada.Id);
        await Semente.EnvioAsync(convidada, t1, StatusEnvio.APROVADO);
        await Semente.EnvioAsync(convidada, t2, StatusEnvio.REJEITADO);
        // não convidada, sem envios → pendência
        await Semente.EmpresaAsync("Nova");
        // desativada com pendente → não conta
        await Semente.EmpresaAsync("Desativada", ativa: false);

        var c = Fluig();
        var p = await (await c.GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(1, p.GetProperty("enviosEmAnalise").GetInt32());
        Assert.Equal(2, p.GetProperty("empresasComPendencia").GetInt32());
        Assert.Equal(1, p.GetProperty("empresasConvidadasSemAcesso").GetInt32());
        Assert.Equal(3, p.GetProperty("empresasAtivas").GetInt32());
        Assert.Equal(2, p.GetProperty("obrasAtivas").GetInt32());

        // convite expirado também conta como "convidada sem acesso"
        Api.Relogio.Advance(TimeSpan.FromDays(8));
        p = await (await Fluig().GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(1, p.GetProperty("empresasConvidadasSemAcesso").GetInt32());
    }

    [Fact]
    public async Task Indicadores_recortados_pela_obra_selecionada()
    {
        var obraA = await Semente.ObraAsync("Obra A");
        var obraB = await Semente.ObraAsync("Obra B");
        var t1 = await Semente.TipoAsync();

        // Na obra A: uma empresa com envio em análise (sem pendência) e uma nova (com pendência).
        var emAnalise = await Semente.EmpresaAsync("Em análise");
        await Semente.EnvioAsync(emAnalise, t1);
        var nova = await Semente.EmpresaAsync("Nova");
        await Semente.VincularAsync(obraA, emAnalise);
        await Semente.VincularAsync(obraA, nova);
        // Na obra B: uma convidada com envio em análise.
        var convidada = await Semente.EmpresaAsync("Convidada");
        await FluxoConvite.ConvidarAsync(Api, convidada.Id);
        await Semente.EnvioAsync(convidada, t1);
        await Semente.VincularAsync(obraB, convidada);
        // Sem obra: não aparece em nenhum recorte.
        await Semente.EmpresaAsync("Solta");

        var a = await (await Fluig().GetAsync($"/api/fluig/painel?obraId={obraA.Id}")).LerAsync();
        Assert.Equal(1, a.GetProperty("enviosEmAnalise").GetInt32());
        Assert.Equal(1, a.GetProperty("empresasComPendencia").GetInt32());
        Assert.Equal(0, a.GetProperty("empresasConvidadasSemAcesso").GetInt32());
        Assert.Equal(2, a.GetProperty("empresasAtivas").GetInt32());
        Assert.Equal(2, a.GetProperty("obrasAtivas").GetInt32());

        var b = await (await Fluig().GetAsync($"/api/fluig/painel?obraId={obraB.Id}")).LerAsync();
        Assert.Equal(1, b.GetProperty("enviosEmAnalise").GetInt32());
        Assert.Equal(1, b.GetProperty("empresasConvidadasSemAcesso").GetInt32());
        Assert.Equal(1, b.GetProperty("empresasAtivas").GetInt32());

        var todas = await (await Fluig().GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(2, todas.GetProperty("enviosEmAnalise").GetInt32());
        Assert.Equal(4, todas.GetProperty("empresasAtivas").GetInt32());
    }

    [Fact]
    public async Task Filtros_de_empresas_por_situacao_de_acesso_e_pendencia()
    {
        var t1 = await Semente.TipoAsync();
        var (ativa, _) = await Semente.EmpresaComAcessoAsync("Ativa");
        await Semente.EnvioAsync(ativa, t1, StatusEnvio.APROVADO);
        var convidada = await Semente.EmpresaAsync("Convidada");
        await FluxoConvite.ConvidarAsync(Api, convidada.Id);
        await Semente.EmpresaAsync("Nova");
        await Semente.EmpresaAsync("Desativada", ativa: false);
        var c = Fluig();

        async Task<string[]> Nomes(string q) =>
            (await (await Fluig().GetAsync("/api/fluig/empresas?" + q)).LerAsync()).GetProperty("itens").EnumerateArray().Select(i => i.Str("razaoSocial")).ToArray();

        Assert.Equal(new[] { "Ativa" }, await Nomes("situacaoAcesso=ATIVA"));
        Assert.Equal(new[] { "Convidada" }, await Nomes("situacaoAcesso=CONVIDADA"));
        Assert.Equal(new[] { "Nova" }, await Nomes("situacaoAcesso=NAO_CONVIDADA"));
        Assert.Equal(new[] { "Desativada" }, await Nomes("situacaoAcesso=DESATIVADA"));
        Assert.Empty(await Nomes("situacaoAcesso=CONVITE_EXPIRADO"));
        Assert.Equal(new[] { "Convidada", "Nova" }, await Nomes("comPendencia=true"));
        Assert.Equal(new[] { "Convidada" }, await Nomes("comPendencia=true&situacaoAcesso=CONVIDADA"));

        var r = await c.GetAsync("/api/fluig/empresas?situacaoAcesso=XYZ");
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.True((await r.LerAsync()).GetProperty("errors").TryGetProperty("situacaoAcesso", out _));

        Api.Relogio.Advance(TimeSpan.FromDays(8));
        Assert.Equal(new[] { "Convidada" }, await Nomes("situacaoAcesso=CONVITE_EXPIRADO"));
    }
}
