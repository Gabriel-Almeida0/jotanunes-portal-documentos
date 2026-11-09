using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Envios;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Fluig;

/// <summary>US5 (002): desvincular encerra o vínculo (histórico preservado); vincular de novo reabre.</summary>
public class VinculoEncerradoTests(ApiFactory api) : TesteApi(api)
{
    private static string Url(Guid obra, Guid empresa) => $"/api/fluig/obras/{obra}/empresas/{empresa}";

    [Fact]
    public async Task Desvincular_encerra_preserva_historico_e_e_idempotente()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync("Alfa Engenharia");
        await Semente.VincularAsync(obra, empresa);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        await Semente.EnvioObraAsync(obra, empresa, art, StatusEnvio.REJEITADO);
        await Semente.EnvioObraAsync(obra, empresa, art, StatusEnvio.APROVADO);

        var c = Fluig("ana.admin");
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync(Url(obra.Id, empresa.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.DeleteAsync(Url(obra.Id, empresa.Id))).StatusCode); // de novo: 204, nada muda

        var vinculo = await Api.NoBancoAsync(db => db.ObraEmpresas.AsNoTracking().SingleAsync());
        Assert.False(vinculo.Ativo);
        Assert.Equal("ana.admin", vinculo.EncerradoPorLogin);
        Assert.NotNull(vinculo.EncerradoEm);
        Assert.Equal(2, await Api.NoBancoAsync(db => db.Envios.CountAsync()));

        var linha = await AuditoriaTeste.UnicaAsync(Api, AcaoAuditoria.VinculoEncerrado);
        Assert.Equal("VINCULO", linha.RecursoTipo);
        Assert.Equal($"{obra.Id:N}:{empresa.Id:N}", linha.RecursoId);
        Assert.Equal("ana.admin", linha.AtorId);

        var detalhe = await (await c.GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync();
        Assert.Empty(detalhe.GetProperty("empresas").EnumerateArray());
        var enc = Assert.Single(detalhe.GetProperty("vinculosEncerrados").EnumerateArray());
        Assert.Equal(empresa.Id, enc.Id("empresaId"));
        Assert.Equal("Alfa Engenharia", enc.Str("razaoSocial"));
        Assert.Equal(empresa.Cnpj, enc.Str("cnpj"));
        Assert.Equal("ana.admin", enc.Str("encerradoPorLogin"));
        Assert.Equal(JsonValueKind.String, enc.GetProperty("encerradoEm").ValueKind);
        Assert.Equal(2, enc.GetProperty("quantidadeEnvios").GetInt32());
        Assert.Equal(0, (await (await c.GetAsync("/api/fluig/obras")).LerAsync()).GetProperty("itens")[0].GetProperty("quantidadeEmpresas").GetInt32());
    }

    [Fact]
    public async Task Desvincular_sem_vinculo_devolve_404()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        var r = await Fluig().DeleteAsync(Url(obra.Id, empresa.Id));
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());
    }

    [Fact]
    public async Task Vincular_de_novo_reabre_com_historico_e_situacao_anterior()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var obra = await Semente.ObraAsync("Obra A");
        await Semente.VincularAsync(obra, empresa);
        var art = await Semente.TipoPorObraAsync("ART da obra");
        await Semente.MarcarAsync(obra, art);
        var aprovado = await Semente.EnvioObraAsync(obra, empresa, art, StatusEnvio.APROVADO);
        var portal = Api.Cliente(token: token);
        var c = Fluig("bia.admin");

        await c.DeleteAsync(Url(obra.Id, empresa.Id));
        Assert.Empty((await (await portal.GetAsync("/api/portal/obras")).LerAsync()).EnumerateArray());

        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync(Url(obra.Id, empresa.Id), null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PutAsync(Url(obra.Id, empresa.Id), null)).StatusCode); // já ativo: nada

        var vinculo = await Api.NoBancoAsync(db => db.ObraEmpresas.AsNoTracking().SingleAsync());
        Assert.True(vinculo.Ativo);
        Assert.Null(vinculo.EncerradoEm);
        Assert.Null(vinculo.EncerradoPorLogin);
        Assert.Equal("bia.admin", vinculo.VinculadoPorLogin);
        var linha = await AuditoriaTeste.UnicaAsync(Api, AcaoAuditoria.VinculoReaberto);
        Assert.Equal($"{obra.Id:N}:{empresa.Id:N}", linha.RecursoId);

        var obras = (await (await portal.GetAsync("/api/portal/obras")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal("Obra A", Assert.Single(obras).Str("nome"));
        var doc = Assert.Single((await (await portal.GetAsync($"/api/portal/obras/{obra.Id}/documentos")).LerAsync()).EnumerateArray());
        Assert.Equal("APROVADO", doc.Str("situacao"));
        Assert.Equal(aprovado.Id, doc.GetProperty("envioAtual").Id());

        var detalhe = await (await c.GetAsync($"/api/fluig/obras/{obra.Id}")).LerAsync();
        Assert.Single(detalhe.GetProperty("empresas").EnumerateArray());
        Assert.Empty(detalhe.GetProperty("vinculosEncerrados").EnumerateArray());
    }

    [Fact]
    public async Task Convite_lista_so_obras_com_vinculo_ativo()
    {
        var empresa = await Semente.EmpresaAsync();
        var ativa = await Semente.ObraAsync("Residencial Ativo");
        var encerrada = await Semente.ObraAsync("Residencial Encerrado");
        await Semente.VincularAsync(ativa, empresa);
        await Semente.VincularAsync(encerrada, empresa, encerrado: true);

        Assert.Equal(HttpStatusCode.Created, (await Fluig().PostAsync($"/api/fluig/empresas/{empresa.Id}/convites", null)).StatusCode);
        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Contains("Residencial Ativo", email.Texto);
        Assert.DoesNotContain("Residencial Encerrado", email.Texto);
    }

    [Fact]
    public async Task Pendencia_da_obra_ignora_vinculo_encerrado()
    {
        var obra = await Semente.ObraAsync();
        var empresa = await Semente.EmpresaAsync();
        await Semente.VincularAsync(obra, empresa);
        var art = await Semente.TipoPorObraAsync();
        await Semente.MarcarAsync(obra, art);
        var c = Fluig();
        Assert.Equal(1, (await (await c.GetAsync("/api/fluig/painel")).LerAsync()).GetProperty("empresasComPendencia").GetInt32());

        await c.DeleteAsync(Url(obra.Id, empresa.Id));
        var painel = await (await c.GetAsync("/api/fluig/painel")).LerAsync();
        Assert.Equal(0, painel.GetProperty("empresasComPendencia").GetInt32());
        Assert.Equal(0, painel.GetProperty("obrasComPendencia").GetInt32());
        Assert.Empty((await (await c.GetAsync($"/api/fluig/empresas?obraId={obra.Id}")).LerAsync()).GetProperty("itens").EnumerateArray());
    }
}
