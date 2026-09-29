using Jotanunes.Docs.Domain.Envios;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Fluig;

public class AnaliseTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public async Task Fila_padrao_em_analise_do_mais_antigo_para_o_mais_novo_com_filtros()
    {
        var obra = await Semente.ObraAsync();
        var alfa = await Semente.EmpresaAsync("Alfa");
        var beta = await Semente.EmpresaAsync("Beta");
        await Semente.VincularAsync(obra, alfa);
        var t1 = await Semente.TipoAsync("Cartão CNPJ");
        var t2 = await Semente.TipoAsync("PCMSO");
        var e1 = await Semente.EnvioAsync(alfa, t1);
        var e2 = await Semente.EnvioAsync(beta, t1);
        var e3 = await Semente.EnvioAsync(alfa, t2);
        await Semente.EnvioAsync(beta, t2, StatusEnvio.APROVADO);

        var c = Fluig();
        var fila = await (await c.GetAsync("/api/fluig/envios")).LerAsync();
        Assert.Equal(3, fila.GetProperty("total").GetInt32());
        Assert.Equal(new[] { e1.Id, e2.Id, e3.Id }, fila.GetProperty("itens").EnumerateArray().Select(i => i.Id()));
        var item = fila.GetProperty("itens")[0];
        Assert.Equal("Alfa", item.GetProperty("empresa").Str("razaoSocial"));
        Assert.Equal(alfa.Cnpj, item.GetProperty("empresa").Str("cnpj"));
        Assert.Equal("Cartão CNPJ", item.GetProperty("tipoDocumento").Str("nome"));
        Assert.Equal("EM_ANALISE", item.Str("status"));

        async Task<Guid[]> Ids(string q) => (await (await c.GetAsync("/api/fluig/envios?" + q)).LerAsync()).GetProperty("itens").EnumerateArray().Select(i => i.Id()).ToArray();
        Assert.Equal(new[] { e1.Id, e3.Id }, await Ids($"obraId={obra.Id}"));
        Assert.Equal(new[] { e2.Id }, await Ids($"empresaId={beta.Id}"));
        Assert.Equal(new[] { e3.Id }, await Ids($"tipoDocumentoId={t2.Id}"));
        Assert.Equal(new[] { e2.Id }, await Ids("pagina=2&tamanhoPagina=1"));
        Assert.Single(await Ids("status=APROVADO"));

        var invalido = await c.GetAsync("/api/fluig/envios?status=QUALQUER");
        Assert.Equal(HttpStatusCode.BadRequest, invalido.StatusCode);
        Assert.Equal("VALIDACAO", await invalido.CodigoAsync());
    }

    [Fact]
    public async Task Aprovados_e_rejeitados_em_ordem_decrescente()
    {
        var empresa = await Semente.EmpresaAsync();
        var a1 = await Semente.EnvioAsync(empresa, await Semente.TipoAsync(), StatusEnvio.APROVADO);
        var a2 = await Semente.EnvioAsync(empresa, await Semente.TipoAsync(), StatusEnvio.APROVADO);
        var ids = (await (await Fluig().GetAsync("/api/fluig/envios?status=APROVADO")).LerAsync()).GetProperty("itens").EnumerateArray().Select(i => i.Id());
        Assert.Equal(new[] { a2.Id, a1.Id }, ids);
    }

    [Fact]
    public async Task Detalhe_e_download_do_envio()
    {
        var empresa = await Semente.EmpresaAsync("Alfa");
        var tipo = await Semente.TipoAsync("Cartão CNPJ");
        var conteudo = ArquivosTeste.Pdf(777);
        var envio = await Semente.EnvioAsync(empresa, tipo, conteudo: conteudo);
        var c = Fluig();

        var d = await (await c.GetAsync($"/api/fluig/envios/{envio.Id}")).LerAsync();
        Assert.Equal(envio.Id, d.Id());
        Assert.Equal(empresa.Id, d.Id("empresaId"));
        Assert.Equal("Alfa", d.GetProperty("empresa").Str("razaoSocial"));
        Assert.Equal("Cartão CNPJ", d.GetProperty("tipoDocumento").Str("nome"));
        Assert.Equal(JsonValueKind.Null, d.GetProperty("analisadoPor").ValueKind);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/envios/{Guid.NewGuid()}")).StatusCode);

        var r = await c.GetAsync($"/api/fluig/envios/{envio.Id}/arquivo");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("attachment; filename*=UTF-8''doc.pdf", r.Content.Headers.ContentDisposition!.ToString());
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.True(r.Headers.CacheControl!.NoStore);
        Assert.Equal(conteudo, await r.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/envios/{Guid.NewGuid()}/arquivo")).StatusCode);
        var auditoria = await Api.NoBancoAsync(db => db.Auditoria.AsNoTracking().SingleAsync(a => a.Acao == "ARQUIVO_BAIXADO"));
        Assert.Equal("FLUIG", auditoria.AtorTipo);
        Assert.Equal("maria.silva", auditoria.AtorId);
    }

    [Fact]
    public async Task Aprovar_registra_analista_do_token()
    {
        var envio = await Semente.EnvioAsync(await Semente.EmpresaAsync(), await Semente.TipoAsync());
        var r = await Fluig("joana.dark", "Joana Dark").PostAsync($"/api/fluig/envios/{envio.Id}/aprovar", null);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("APROVADO", j.Str("status"));
        Assert.Equal("joana.dark", j.GetProperty("analisadoPor").Str("login"));
        Assert.Equal("Joana Dark", j.GetProperty("analisadoPor").Str("nome"));
        Assert.NotEqual(JsonValueKind.Null, j.GetProperty("analisadoEm").ValueKind);
        Assert.Equal(1, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "ENVIO_APROVADO" && a.AtorId == "joana.dark")));
        Assert.Equal(HttpStatusCode.NotFound, (await Fluig().PostAsync($"/api/fluig/envios/{Guid.NewGuid()}/aprovar", null)).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("abcd")]
    [InlineData("   abcd   ")]
    public async Task Rejeitar_sem_motivo_valido_devolve_validacao(string? motivo)
    {
        var envio = await Semente.EnvioAsync(await Semente.EmpresaAsync(), await Semente.TipoAsync());
        var r = await Fluig().PostAsJsonAsync($"/api/fluig/envios/{envio.Id}/rejeitar", new { motivo });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Equal("VALIDACAO", await r.CodigoAsync());
        Assert.True((await r.LerAsync()).GetProperty("errors").TryGetProperty("motivo", out _));
    }

    [Fact]
    public async Task Rejeitar_com_motivo_envia_email_e_permite_novo_envio()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync("Alfa Engenharia");
        var tipo = await Semente.TipoAsync("Cartão CNPJ");
        var envio = await Semente.EnvioAsync(empresa, tipo);
        var r = await Fluig().PostAsJsonAsync($"/api/fluig/envios/{envio.Id}/rejeitar", new { motivo = "  Documento ilegível, envie de novo  " });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("REJEITADO", j.Str("status"));
        Assert.Equal("Documento ilegível, envie de novo", j.Str("motivoRejeicao"));

        var email = Assert.Single(Api.Emails.Mensagens);
        Assert.Equal(empresa.EmailContato, email.Para);
        Assert.Contains("Cartão CNPJ", email.Texto);
        Assert.Contains("Documento ilegível, envie de novo", email.Texto);
        Assert.Contains(ApiFactory.PortalBaseUrl, email.Texto);

        var portal = Api.Cliente(token: token);
        var docs = await (await portal.GetAsync("/api/portal/documentos")).LerAsync();
        Assert.Equal("REJEITADO", docs[0].Str("situacao"));
        Assert.True(docs[0].GetProperty("podeEnviar").GetBoolean());
        Assert.Equal(HttpStatusCode.Created, (await portal.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
    }

    [Fact]
    public async Task Falha_no_email_de_rejeicao_nao_desfaz_a_decisao()
    {
        var envio = await Semente.EnvioAsync(await Semente.EmpresaAsync(), await Semente.TipoAsync());
        Api.Emails.Falhar = true;
        var r = await Fluig().PostAsJsonAsync($"/api/fluig/envios/{envio.Id}/rejeitar", new { motivo = "Documento vencido" });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var status = await Api.NoBancoAsync(async db => (await db.Envios.AsNoTracking().SingleAsync(e => e.Id == envio.Id)).Status);
        Assert.Equal(StatusEnvio.REJEITADO, status);
        Assert.Contains(Api.Logs.Linhas, l => l.StartsWith("Warning", StringComparison.Ordinal) && l.Contains("rejeição"));
    }

    [Fact]
    public async Task Envio_ja_analisado_devolve_409()
    {
        var envio = await Semente.EnvioAsync(await Semente.EmpresaAsync(), await Semente.TipoAsync(), StatusEnvio.APROVADO);
        var r = await Fluig().PostAsync($"/api/fluig/envios/{envio.Id}/aprovar", null);
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("ENVIO_JA_ANALISADO", await r.CodigoAsync());
        Assert.Equal("Este envio já foi analisado.", (await r.LerAsync()).Str("title"));
        var rej = await Fluig().PostAsJsonAsync($"/api/fluig/envios/{envio.Id}/rejeitar", new { motivo = "motivo qualquer" });
        Assert.Equal("ENVIO_JA_ANALISADO", await rej.CodigoAsync());
    }

    [Fact]
    public async Task Aprovacoes_simultaneas_uma_passa_e_outra_409()
    {
        for (var rodada = 0; rodada < 3; rodada++)
        {
            var envio = await Semente.EnvioAsync(await Semente.EmpresaAsync(), await Semente.TipoAsync());
            var respostas = await Task.WhenAll(
                Fluig("ana", "Ana").PostAsync($"/api/fluig/envios/{envio.Id}/aprovar", null),
                Fluig("bia", "Bia").PostAsJsonAsync($"/api/fluig/envios/{envio.Id}/rejeitar", new { motivo = "motivo concorrente" }),
                Fluig("caio", "Caio").PostAsync($"/api/fluig/envios/{envio.Id}/aprovar", null));
            Assert.Equal(1, respostas.Count(r => r.StatusCode == HttpStatusCode.OK));
            Assert.Equal(2, respostas.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        }
    }

    [Fact]
    public async Task Envio_de_tipo_desativado_ainda_pode_ser_aprovado()
    {
        var tipo = await Semente.TipoAsync("Tipo que será desativado");
        var envio = await Semente.EnvioAsync(await Semente.EmpresaAsync(), tipo);
        await Fluig().PutAsJsonAsync($"/api/fluig/tipos-documento/{tipo.Id}", new { nome = tipo.Nome, ativo = false });
        Assert.Equal(HttpStatusCode.OK, (await Fluig().PostAsync($"/api/fluig/envios/{envio.Id}/aprovar", null)).StatusCode);
    }

    [Fact]
    public async Task Documentos_da_empresa_e_historico_por_tipo_inclusive_inativo()
    {
        var empresa = await Semente.EmpresaAsync();
        var cartao = await Semente.TipoAsync("Cartão CNPJ");
        var pcmso = await Semente.TipoAsync("PCMSO");
        var rejeitado = await Semente.EnvioAsync(empresa, cartao, StatusEnvio.REJEITADO, "Documento ilegível");
        var c = Fluig();
        await c.PostAsync($"/api/fluig/envios/{(await Semente.EnvioAsync(empresa, cartao)).Id}/aprovar", null);

        var docs = await (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos")).LerAsync();
        Assert.Equal(new[] { "Cartão CNPJ", "PCMSO" }, docs.EnumerateArray().Select(d => d.GetProperty("tipoDocumento").Str("nome")));
        Assert.Equal("APROVADO", docs[0].Str("situacao"));
        Assert.Equal(2, docs[0].GetProperty("quantidadeEnvios").GetInt32());
        Assert.Equal("maria.silva", docs[0].GetProperty("envioAtual").GetProperty("analisadoPor").Str("login"));
        Assert.Equal("PENDENTE_ENVIO", docs[1].Str("situacao"));
        Assert.Equal(0, docs[1].GetProperty("quantidadeEnvios").GetInt32());

        var hist = await (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos/{cartao.Id}/envios")).LerAsync();
        Assert.Equal(2, hist.GetArrayLength());
        Assert.Equal("APROVADO", hist[0].Str("status"));
        Assert.Equal("maria.silva", hist[0].GetProperty("analisadoPor").Str("login"));
        Assert.Equal(rejeitado.Id, hist[1].Id());
        Assert.Equal("Documento ilegível", hist[1].Str("motivoRejeicao"));
        Assert.Equal("analista", hist[1].GetProperty("analisadoPor").Str("login"));

        await c.PutAsJsonAsync($"/api/fluig/tipos-documento/{cartao.Id}", new { nome = cartao.Nome, ativo = false });
        Assert.Equal(2, (await (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos/{cartao.Id}/envios")).LerAsync()).GetArrayLength());
        Assert.Single((await (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos")).LerAsync()).EnumerateArray());

        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/empresas/{Guid.NewGuid()}/documentos")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/fluig/empresas/{empresa.Id}/documentos/{Guid.NewGuid()}/envios")).StatusCode);
        Assert.Equal(pcmso.Id, docs[1].GetProperty("tipoDocumento").Id());
    }
}
