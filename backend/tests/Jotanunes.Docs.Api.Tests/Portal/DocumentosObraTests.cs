using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Portal;

/// <summary>US2 (002): a empresa envia os documentos de cada obra pelo portal.</summary>
public class DocumentosObraTests(ApiFactory api) : TesteApi(api)
{
    private sealed record Cena(Empresa Empresa, HttpClient Cliente, Obra A, Obra B, TipoDocumento Art, TipoDocumento Geral);

    /// <summary>Empresa logada nas obras A e B, com "ART da obra" (POR_OBRA) exigido nas duas e um tipo geral.</summary>
    private async Task<Cena> CenaAsync()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var a = await Semente.ObraAsync("Obra Alfa");
        var b = await Semente.ObraAsync("Obra Beta");
        await Semente.VincularAsync(a, empresa);
        await Semente.VincularAsync(b, empresa);
        var art = await Semente.TipoPorObraAsync("ART da obra");
        await Semente.MarcarAsync(a, art);
        await Semente.MarcarAsync(b, art);
        var geral = await Semente.TipoAsync("Cartão CNPJ");
        return new Cena(empresa, Api.Cliente(token: token), a, b, art, geral);
    }

    private static string Docs(Obra o) => $"/api/portal/obras/{o.Id}/documentos";

    private static string Envios(Obra o, TipoDocumento t) => $"/api/portal/obras/{o.Id}/documentos/{t.Id}/envios";

    [Fact]
    public async Task Obras_so_ativas_com_vinculo_ativo_com_contagem_e_pendencia_primeiro()
    {
        var c = await CenaAsync();
        var semPendencia = await Semente.ObraAsync("Obra Aaa sem pendência");
        await Semente.VincularAsync(semPendencia, c.Empresa); // nenhum tipo marcado → nada pendente
        var inativa = await Semente.ObraAsync("Obra inativa", ativa: false);
        await Semente.VincularAsync(inativa, c.Empresa);
        var encerrada = await Semente.ObraAsync("Obra encerrada");
        await Semente.VincularAsync(encerrada, c.Empresa, encerrado: true);
        await Semente.ObraAsync("Obra de ninguém");
        await Semente.EnvioObraAsync(c.A, c.Empresa, c.Art, StatusEnvio.APROVADO);

        var r = await c.Cliente.GetAsync("/api/portal/obras");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var obras = (await r.LerAsync()).EnumerateArray().ToList();
        // Beta tem pendência; Alfa (aprovada) e "Aaa" não: pendência primeiro, depois nome.
        Assert.Equal(new[] { "Obra Beta", "Obra Aaa sem pendência", "Obra Alfa" }, obras.Select(o => o.Str("nome")));
        var beta = obras[0];
        Assert.Equal("Aracaju", beta.Str("cidade"));
        Assert.Equal("SE", beta.Str("uf"));
        Assert.Equal(1, beta.GetProperty("documentos").GetProperty("total").GetInt32());
        Assert.Equal(1, beta.GetProperty("documentos").GetProperty("pendentes").GetInt32());
        var alfa = obras[2].GetProperty("documentos");
        Assert.Equal(1, alfa.GetProperty("aprovados").GetInt32());
        Assert.Equal(0, alfa.GetProperty("pendentes").GetInt32());
        Assert.Equal(0, obras[1].GetProperty("documentos").GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Envio_numa_obra_muda_so_aquela_obra()
    {
        var c = await CenaAsync();
        var r = await c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf(), "art.pdf"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var envio = await r.LerAsync();
        Assert.Equal("EM_ANALISE", envio.Str("status"));
        Assert.Equal(c.A.Id, envio.Id("obraId"));
        Assert.Equal($"/api/portal/obras/{c.A.Id}/documentos/{c.Art.Id}/envios", r.Headers.Location!.OriginalString);
        var salvo = await Api.NoBancoAsync(db => db.Envios.AsNoTracking().SingleAsync());
        Assert.Equal(c.A.Id, salvo.ObraId);
        Assert.Equal($"empresas/{c.Empresa.Id:N}/{salvo.Id:N}", salvo.ChaveArmazenamento);

        var docsA = (await (await c.Cliente.GetAsync(Docs(c.A))).LerAsync()).EnumerateArray().ToList();
        var docsB = (await (await c.Cliente.GetAsync(Docs(c.B))).LerAsync()).EnumerateArray().ToList();
        Assert.Equal("EM_ANALISE", Assert.Single(docsA).Str("situacao"));
        Assert.False(docsA[0].GetProperty("podeEnviar").GetBoolean());
        Assert.Equal(c.A.Id, docsA[0].GetProperty("envioAtual").Id("obraId"));
        Assert.Equal("PENDENTE_ENVIO", Assert.Single(docsB).Str("situacao"));
        Assert.True(docsB[0].GetProperty("podeEnviar").GetBoolean());

        // Geral não muda.
        var gerais = (await (await c.Cliente.GetAsync("/api/portal/documentos")).LerAsync()).EnumerateArray().ToList();
        Assert.Equal("Cartão CNPJ", Assert.Single(gerais).GetProperty("tipoDocumento").Str("nome"));
        Assert.Equal("PENDENTE_ENVIO", gerais[0].Str("situacao"));

        // Histórico por obra.
        Assert.Equal(1, (await (await c.Cliente.GetAsync(Envios(c.A, c.Art))).LerAsync()).GetArrayLength());
        Assert.Equal(0, (await (await c.Cliente.GetAsync(Envios(c.B, c.Art))).LerAsync()).GetArrayLength());

        // Segundo envio na mesma obra: 409; na outra obra: aceito.
        var de_novo = await c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf()));
        Assert.Equal(HttpStatusCode.Conflict, de_novo.StatusCode);
        Assert.Equal("ENVIO_NAO_PERMITIDO", await de_novo.CodigoAsync());
        Assert.Equal(HttpStatusCode.Created, (await c.Cliente.PostAsync(Envios(c.B, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
    }

    [Fact]
    public async Task Rejeitado_na_obra_pode_reenviar()
    {
        var c = await CenaAsync();
        await Semente.EnvioObraAsync(c.A, c.Empresa, c.Art, StatusEnvio.REJEITADO, "Falta assinatura");
        var doc = (await (await c.Cliente.GetAsync(Docs(c.A))).LerAsync())[0];
        Assert.Equal("REJEITADO", doc.Str("situacao"));
        Assert.True(doc.GetProperty("podeEnviar").GetBoolean());
        Assert.Equal("Falta assinatura", doc.GetProperty("envioAtual").Str("motivoRejeicao"));
        Assert.Equal(HttpStatusCode.Created, (await c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
    }

    [Fact]
    public async Task Duas_abas_mesmo_documento_da_obra_so_um_aceito()
    {
        var c = await CenaAsync();
        var respostas = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ =>
            c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf()))));
        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(respostas, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(1, await Api.NoBancoAsync(db => db.Envios.CountAsync()));
    }

    [Fact]
    public async Task Mesma_empresa_e_tipo_em_obras_diferentes_ao_mesmo_tempo_ambos_aceitos()
    {
        var c = await CenaAsync();
        var respostas = await Task.WhenAll(
            c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf())),
            c.Cliente.PostAsync(Envios(c.B, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf())));
        Assert.All(respostas, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        Assert.Equal(2, await Api.NoBancoAsync(db => db.Envios.CountAsync(e => e.Status == StatusEnvio.EM_ANALISE)));
    }

    [Fact]
    public async Task Documento_geral_e_da_obra_do_mesmo_tipo_nao_se_misturam_no_indice()
    {
        // Banco: um vivo geral (obra nula) e um vivo por obra convivem; dois vivos gerais não (NULLS NOT DISTINCT).
        var c = await CenaAsync();
        await Semente.EnvioAsync(c.Empresa, c.Geral);
        await Assert.ThrowsAnyAsync<DbUpdateException>(() => Semente.EnvioAsync(c.Empresa, c.Geral));
        await Semente.EnvioObraAsync(c.A, c.Empresa, c.Art);
        await Assert.ThrowsAnyAsync<DbUpdateException>(() => Semente.EnvioObraAsync(c.A, c.Empresa, c.Art));
    }

    [Fact]
    public async Task Rotas_gerais_so_atendem_tipo_geral_e_rotas_de_obra_so_tipo_por_obra()
    {
        var c = await CenaAsync();
        // Tipo POR_OBRA na rota geral → 404.
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.GetAsync($"/api/portal/documentos/{c.Art.Id}/envios")).StatusCode);
        var r = await c.Cliente.PostAsync($"/api/portal/documentos/{c.Art.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()));
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r.CodigoAsync());
        // Tipo GERAL na rota de obra → 404.
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.GetAsync(Envios(c.A, c.Geral))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.PostAsync(Envios(c.A, c.Geral), ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Envios.CountAsync()));
        // /portal/documentos: só gerais.
        var gerais = (await (await c.Cliente.GetAsync("/api/portal/documentos")).LerAsync()).EnumerateArray();
        Assert.All(gerais, d => Assert.Equal("GERAL", d.GetProperty("tipoDocumento").Str("abrangencia")));
    }

    [Fact]
    public async Task Obra_sem_tipos_exigidos_lista_vazia_e_ordem_por_situacao()
    {
        var c = await CenaAsync();
        var vazia = await Semente.ObraAsync();
        await Semente.VincularAsync(vazia, c.Empresa);
        Assert.Equal(0, (await (await c.Cliente.GetAsync(Docs(vazia))).LerAsync()).GetArrayLength());

        var os = await Semente.TipoPorObraAsync("Ordem de serviço");
        var inativo = await Semente.TipoPorObraAsync("Inativo", ativo: false);
        await Semente.MarcarAsync(c.A, os, inativo);
        await Semente.EnvioObraAsync(c.A, c.Empresa, c.Art, StatusEnvio.APROVADO);
        var docs = (await (await c.Cliente.GetAsync(Docs(c.A))).LerAsync()).EnumerateArray().ToList();
        Assert.Equal(new[] { "Ordem de serviço", "ART da obra" }, docs.Select(d => d.GetProperty("tipoDocumento").Str("nome")));
        Assert.Equal(new[] { "PENDENTE_ENVIO", "APROVADO" }, docs.Select(d => d.Str("situacao")));

        // Tipo marcado mas inativo: não aceita envio (404).
        Assert.Equal(HttpStatusCode.NotFound, (await c.Cliente.PostAsync(Envios(c.A, inativo), ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
    }

    [Fact]
    public async Task Envio_por_obra_usa_as_mesmas_regras_de_arquivo()
    {
        var c = await CenaAsync();
        var exe = await c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Exe(), "x.exe"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, exe.StatusCode);
        Assert.Equal("ARQUIVO_TIPO_NAO_SUPORTADO", await exe.CodigoAsync());
        var grande = await c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf((int)EnvioDocumento.TamanhoMaximoBytes + 1)));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, grande.StatusCode);
        var semCampo = await c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(ArquivosTeste.Pdf(), campo: "outro"));
        Assert.Equal(HttpStatusCode.BadRequest, semCampo.StatusCode);
        Assert.Equal("VALIDACAO", await semCampo.CodigoAsync());
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Envios.CountAsync()));
    }

    [Fact]
    public async Task Envio_por_obra_e_auditado_e_baixado()
    {
        var c = await CenaAsync();
        var conteudo = ArquivosTeste.Pdf(2048);
        var envio = await (await c.Cliente.PostAsync(Envios(c.A, c.Art), ArquivosTeste.Form(conteudo))).LerAsync();
        var linha = await AuditoriaTeste.UnicaAsync(Api, Domain.Auditoria.AcaoAuditoria.DocumentoEnviado);
        Assert.Equal(envio.Id().ToString(), linha.RecursoId);
        var arquivo = await c.Cliente.GetAsync($"/api/portal/envios/{envio.Id()}/arquivo");
        Assert.Equal(HttpStatusCode.OK, arquivo.StatusCode);
        Assert.Equal(conteudo, await arquivo.Content.ReadAsByteArrayAsync());
    }
}
