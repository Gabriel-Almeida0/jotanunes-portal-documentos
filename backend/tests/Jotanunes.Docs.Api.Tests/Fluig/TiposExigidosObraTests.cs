using Jotanunes.Docs.Domain.Auditoria;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Fluig;

/// <summary>US1 (002): tipos POR_OBRA exigidos em cada obra.</summary>
public class TiposExigidosObraTests(ApiFactory api) : TesteApi(api)
{
    private static string Url(Guid obra, Guid? tipo = null) =>
        tipo is null ? $"/api/fluig/obras/{obra}/tipos-documento" : $"/api/fluig/obras/{obra}/tipos-documento/{tipo}";

    [Fact]
    public async Task Lista_so_por_obra_ativos_e_inativos_marcados_por_nome()
    {
        var obra = await Semente.ObraAsync();
        await Semente.TipoAsync("Cartão CNPJ"); // geral: fora da lista
        var ordem = await Semente.TipoPorObraAsync("Ordem de serviço");
        var art = await Semente.TipoPorObraAsync("ART da obra");
        var inativoMarcado = await Semente.TipoPorObraAsync("Diário de obra", ativo: false);
        await Semente.TipoPorObraAsync("Zeta inativo", ativo: false); // inativo não marcado: fora
        await Semente.MarcarAsync(obra, art, inativoMarcado);

        var r = await Fluig().GetAsync(Url(obra.Id));
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var itens = (await r.LerAsync()).EnumerateArray().ToList();
        Assert.Equal(new[] { "ART da obra", "Diário de obra", "Ordem de serviço" }, itens.Select(i => i.GetProperty("tipoDocumento").Str("nome")));
        Assert.Equal(new[] { true, true, false }, itens.Select(i => i.GetProperty("exigido").GetBoolean()));
        Assert.Equal(JsonValueKind.String, itens[0].GetProperty("marcadoEm").ValueKind);
        Assert.Equal(JsonValueKind.Null, itens[2].GetProperty("marcadoEm").ValueKind);
        Assert.Equal("POR_OBRA", itens[0].GetProperty("tipoDocumento").Str("abrangencia"));
        Assert.False(itens[1].GetProperty("tipoDocumento").GetProperty("ativo").GetBoolean());
        Assert.Equal(ordem.Id, itens[2].GetProperty("tipoDocumento").Id());

        // Exigidos na obra: só os marcados e ativos.
        var detalhe = await (await Fluig().GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync();
        Assert.Equal(1, detalhe.GetProperty("quantidadeTiposExigidos").GetInt32());
        var lista = await (await Fluig().GetAsync("/api/fluig/obras")).LerAsync();
        Assert.Equal(1, lista.GetProperty("itens")[0].GetProperty("quantidadeTiposExigidos").GetInt32());
    }

    [Fact]
    public async Task Marcado_na_obra_A_nao_aparece_na_obra_B()
    {
        var a = await Semente.ObraAsync();
        var b = await Semente.ObraAsync();
        var art = await Semente.TipoPorObraAsync("ART da obra");
        var c = Fluig();
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync(Url(a.Id, art.Id), null)).StatusCode);

        Assert.True((await (await c.GetAsync(Url(a.Id))).LerAsync())[0].GetProperty("exigido").GetBoolean());
        Assert.False((await (await c.GetAsync(Url(b.Id))).LerAsync())[0].GetProperty("exigido").GetBoolean());
    }

    [Fact]
    public async Task Marcar_e_idempotente_e_audita_so_quando_muda()
    {
        var obra = await Semente.ObraAsync();
        var art = await Semente.TipoPorObraAsync();
        var c = Fluig("ana.admin");
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync(Url(obra.Id, art.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync(Url(obra.Id, art.Id), null)).StatusCode);
        Assert.Equal(1, await Api.NoBancoAsync(db => db.ObraTiposDocumento.CountAsync()));
        var marcacao = await Api.NoBancoAsync(db => db.ObraTiposDocumento.AsNoTracking().SingleAsync());
        Assert.Equal("ana.admin", marcacao.MarcadoPorLogin);

        var linha = await AuditoriaTeste.UnicaAsync(Api, AcaoAuditoria.ObraTipoMarcado);
        Assert.Equal("OBRA", linha.RecursoTipo);
        Assert.Equal($"{obra.Id:N}:{art.Id:N}", linha.RecursoId);
        Assert.Equal("ana.admin", linha.AtorId);
        Assert.True(linha.AtorAdmin);
    }

    [Fact]
    public async Task Marcacoes_simultaneas_nao_duplicam()
    {
        var obra = await Semente.ObraAsync();
        var art = await Semente.TipoPorObraAsync();
        var respostas = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Fluig().PutAsync(Url(obra.Id, art.Id), null)));
        Assert.All(respostas, r => Assert.Equal(HttpStatusCode.NoContent, r.StatusCode));
        Assert.Equal(1, await Api.NoBancoAsync(db => db.ObraTiposDocumento.CountAsync()));
        Assert.Single(await AuditoriaTeste.LinhasAsync(Api, AcaoAuditoria.ObraTipoMarcado));
    }

    [Fact]
    public async Task Marcar_tipo_geral_devolve_400_TIPO_NAO_E_POR_OBRA()
    {
        var obra = await Semente.ObraAsync();
        var geral = await Semente.TipoAsync();
        var r = await Fluig().PutAsync(Url(obra.Id, geral.Id), null);
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("TIPO_NAO_E_POR_OBRA", await r.CodigoAsync());
        Assert.Equal("Só tipos de documento por obra podem ser exigidos de uma obra.", (await r.LerAsync()).Str("title"));
        Assert.Equal(0, await Api.NoBancoAsync(db => db.ObraTiposDocumento.CountAsync()));
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync()));
    }

    [Fact]
    public async Task Marcar_tipo_inativo_e_permitido()
    {
        var obra = await Semente.ObraAsync();
        var inativo = await Semente.TipoPorObraAsync(ativo: false);
        Assert.Equal(HttpStatusCode.NoContent, (await Fluig().PutAsync(Url(obra.Id, inativo.Id), null)).StatusCode);
        Assert.Equal(1, await Api.NoBancoAsync(db => db.ObraTiposDocumento.CountAsync()));
    }

    [Fact]
    public async Task Desmarcar_e_idempotente_preserva_envios_e_audita_so_quando_muda()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        await Semente.VincularAsync(obra, empresa);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        await Semente.EnvioObraAsync(obra, empresa, art, Domain.Envios.StatusEnvio.APROVADO);

        var c = Fluig();
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync(Url(obra.Id, art.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync(Url(obra.Id, art.Id))).StatusCode);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.ObraTiposDocumento.CountAsync()));
        Assert.Equal(1, await Api.NoBancoAsync(db => db.Envios.CountAsync()));

        var linha = await AuditoriaTeste.UnicaAsync(Api, AcaoAuditoria.ObraTipoDesmarcado);
        Assert.Equal($"{obra.Id:N}:{art.Id:N}", linha.RecursoId);

        // Desmarcado: sai das pendências da obra, mas o histórico continua consultável.
        var docs = (await (await c.GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}/documentos")).LerAsync());
        Assert.Equal(0, docs.GetArrayLength());
        var historico = await (await c.GetAsync($"/api/fluig/obras/{obra.Id}/empresas/{empresa.Id}/documentos/{art.Id}/envios")).LerAsync();
        Assert.Equal(1, historico.GetArrayLength());
    }

    [Fact]
    public async Task Obra_ou_tipo_inexistentes_devolvem_404()
    {
        var obra = await Semente.ObraAsync();
        var art = await Semente.TipoPorObraAsync();
        var c = Fluig();
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync(Url(Guid.NewGuid()))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.PutAsync(Url(Guid.NewGuid(), art.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.PutAsync(Url(obra.Id, Guid.NewGuid()), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.DeleteAsync(Url(Guid.NewGuid(), art.Id))).StatusCode);
        var r = await c.DeleteAsync(Url(obra.Id, Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Comum_le_mas_nao_marca()
    {
        var obra = await Semente.ObraAsync();
        var art = await Semente.TipoPorObraAsync();
        var comum = Api.Cliente(token: Tokens.FluigComum(Api));
        Assert.Equal(HttpStatusCode.OK, (await comum.GetAsync(Url(obra.Id))).StatusCode);
        var r = await comum.PutAsync(Url(obra.Id, art.Id), null);
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        Assert.Equal("SEM_PERMISSAO", await r.CodigoAsync());
        Assert.Equal(HttpStatusCode.Forbidden, (await comum.DeleteAsync(Url(obra.Id, art.Id))).StatusCode);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.ObraTiposDocumento.CountAsync()));
    }
}
