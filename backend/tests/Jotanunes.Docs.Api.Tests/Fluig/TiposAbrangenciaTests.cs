using Jotanunes.Docs.Domain.Auditoria;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Fluig;

/// <summary>US1 (002): abrangência do tipo de documento (GERAL | POR_OBRA).</summary>
public class TiposAbrangenciaTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Criar_exige_abrangencia()
    {
        var c = Fluig();
        var sem = await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "ART da obra" });
        Assert.Equal(HttpStatusCode.BadRequest, sem.StatusCode);
        Assert.Equal("VALIDACAO", await sem.CodigoAsync());
        Assert.True((await sem.LerAsync()).GetProperty("errors").TryGetProperty("abrangencia", out _));

        var invalida = await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "ART da obra", abrangencia = "QUALQUER" });
        Assert.Equal(HttpStatusCode.BadRequest, invalida.StatusCode);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.TiposDocumento.CountAsync()));

        var r = await c.PostAsJsonAsync("/api/fluig/tipos-documento", new { nome = "ART da obra", abrangencia = "POR_OBRA" });
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.Equal("POR_OBRA", (await r.LerAsync()).Str("abrangencia"));
    }

    [Fact]
    public async Task Atualizar_exige_abrangencia()
    {
        var t = await Semente.TipoAsync();
        var r = await Fluig().PutAsJsonAsync($"/api/fluig/tipos-documento/{t.Id}", new { nome = t.Nome, ativo = true });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.True((await r.LerAsync()).GetProperty("errors").TryGetProperty("abrangencia", out _));
    }

    [Fact]
    public async Task Filtro_por_abrangencia()
    {
        await Semente.TipoAsync("Cartão CNPJ");
        await Semente.TipoPorObraAsync("ART da obra");
        await Semente.TipoPorObraAsync("Ordem de serviço", ativo: false);
        var c = Fluig();

        async Task<string[]> Nomes(string q) =>
            (await (await c.GetAsync("/api/fluig/tipos-documento" + q)).LerAsync()).EnumerateArray().Select(t => t.Str("nome")).ToArray();
        Assert.Equal(new[] { "ART da obra", "Cartão CNPJ", "Ordem de serviço" }, await Nomes(""));
        Assert.Equal(new[] { "Cartão CNPJ" }, await Nomes("?abrangencia=GERAL"));
        Assert.Equal(new[] { "ART da obra", "Ordem de serviço" }, await Nomes("?abrangencia=POR_OBRA"));
        Assert.Equal(new[] { "ART da obra" }, await Nomes("?abrangencia=POR_OBRA&ativo=true"));
        var todos = (await (await c.GetAsync("/api/fluig/tipos-documento")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal(new[] { "POR_OBRA", "GERAL", "POR_OBRA" }, todos.Select(t => t.Str("abrangencia")));

        var invalido = await c.GetAsync("/api/fluig/tipos-documento?abrangencia=OUTRA");
        Assert.Equal(HttpStatusCode.BadRequest, invalido.StatusCode);
        Assert.Equal("VALIDACAO", await invalido.CodigoAsync());
    }

    [Fact]
    public async Task Trocar_abrangencia_de_tipo_com_envio_devolve_409()
    {
        var empresa = await Semente.EmpresaAsync();
        var tipo = await Semente.TipoAsync("Cartão CNPJ");
        await Semente.EnvioAsync(empresa, tipo, Domain.Envios.StatusEnvio.REJEITADO);

        var r = await Fluig().PutAsJsonAsync($"/api/fluig/tipos-documento/{tipo.Id}",
            new { nome = "Cartão CNPJ novo", abrangencia = "POR_OBRA", ativo = true });
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("ABRANGENCIA_IMUTAVEL", await r.CodigoAsync());
        Assert.Equal("A abrangência não pode ser alterada porque este tipo já tem envios.", (await r.LerAsync()).Str("title"));
        var salvo = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().SingleAsync(t => t.Id == tipo.Id));
        Assert.Equal(Domain.TiposDocumento.Abrangencia.GERAL, salvo.Abrangencia);
        Assert.Equal("Cartão CNPJ", salvo.Nome); // nada foi gravado

        // Mesma abrangência com envios: atualização normal.
        var ok = await Fluig().PutAsJsonAsync($"/api/fluig/tipos-documento/{tipo.Id}", new { nome = "Cartão CNPJ novo", abrangencia = "GERAL", ativo = true });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Empty(await AuditoriaTeste.LinhasAsync(Api, AcaoAuditoria.TipoAbrangenciaAlterada));
    }

    [Fact]
    public async Task Por_obra_para_geral_sem_envios_remove_marcacoes_e_audita()
    {
        var obraA = await Semente.ObraAsync();
        var obraB = await Semente.ObraAsync();
        var tipo = await Semente.TipoPorObraAsync("ART da obra");
        var outro = await Semente.TipoPorObraAsync("Ordem de serviço");
        await Semente.MarcarAsync(obraA, tipo, outro);
        await Semente.MarcarAsync(obraB, tipo);

        var r = await Fluig("ana.admin").PutAsJsonAsync($"/api/fluig/tipos-documento/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "GERAL", ativo = true });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("GERAL", (await r.LerAsync()).Str("abrangencia"));

        var marcacoes = await Api.NoBancoAsync(db => db.ObraTiposDocumento.AsNoTracking().ToListAsync());
        var unica = Assert.Single(marcacoes);
        Assert.Equal(outro.Id, unica.TipoDocumentoId);

        var auditoria = await AuditoriaTeste.UnicaAsync(Api, AcaoAuditoria.TipoAbrangenciaAlterada);
        Assert.Equal("TIPO_DOCUMENTO", auditoria.RecursoTipo);
        Assert.Equal(tipo.Id.ToString(), auditoria.RecursoId);
        Assert.Equal("ana.admin", auditoria.AtorId);

        // Geral → por obra sem envios também é permitido.
        var volta = await Fluig().PutAsJsonAsync($"/api/fluig/tipos-documento/{tipo.Id}", new { nome = tipo.Nome, abrangencia = "POR_OBRA", ativo = true });
        Assert.Equal(HttpStatusCode.OK, volta.StatusCode);
        Assert.Equal(2, (await AuditoriaTeste.LinhasAsync(Api, AcaoAuditoria.TipoAbrangenciaAlterada)).Count);
    }

    [Fact]
    public async Task Catalogo_padrao_nasce_geral()
    {
        await using var host = Api.ComCatalogoPadrao();
        Assert.NotNull(await Task.Run(() => host.Services)); // sobe o host (migrations + semeador)
        var tipos = await Api.NoBancoAsync(db => db.TiposDocumento.AsNoTracking().ToListAsync());
        Assert.Equal(10, tipos.Count);
        Assert.All(tipos, t => Assert.Equal(Domain.TiposDocumento.Abrangencia.GERAL, t.Abrangencia));
    }

    [Fact]
    public async Task Documentos_gerais_da_empresa_ignoram_tipos_por_obra()
    {
        var empresa = await Semente.EmpresaAsync();
        await Semente.TipoAsync("Cartão CNPJ");
        await Semente.TipoPorObraAsync("ART da obra");
        var c = Fluig();
        var docs = (await (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}")).LerAsync()).GetProperty("documentos");
        Assert.Equal(1, docs.GetProperty("total").GetInt32());
        var lista = (await (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal("Cartão CNPJ", Assert.Single(lista).GetProperty("tipoDocumento").Str("nome"));
        Assert.Equal("GERAL", lista[0].GetProperty("tipoDocumento").Str("abrangencia"));
    }
}
