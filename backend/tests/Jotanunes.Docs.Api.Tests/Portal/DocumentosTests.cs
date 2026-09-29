using Jotanunes.Docs.Domain.Envios;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Portal;

public class DocumentosTests(ApiFactory api) : TesteApi(api)
{
    private async Task<(Domain.Empresas.Empresa Empresa, HttpClient Cliente)> EmpresaLogadaAsync()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        return (empresa, Api.Cliente(token: token));
    }

    [Fact]
    public async Task Lista_todos_os_tipos_ativos_na_ordem_do_contrato()
    {
        var (empresa, c) = await EmpresaLogadaAsync();
        var aprovado = await Semente.TipoAsync("A - aprovado");
        var analise = await Semente.TipoAsync("B - em análise");
        var rejeitado = await Semente.TipoAsync("C - rejeitado");
        await Semente.TipoAsync("D - pendente");
        await Semente.TipoAsync("Z - inativo", ativo: false);
        await Semente.EnvioAsync(empresa, aprovado, StatusEnvio.APROVADO);
        await Semente.EnvioAsync(empresa, analise);
        await Semente.EnvioAsync(empresa, rejeitado, StatusEnvio.REJEITADO, "Documento ilegível");

        var r = await c.GetAsync("/api/portal/documentos");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var docs = (await r.LerAsync()).EnumerateArray().ToList();
        Assert.Equal(new[] { "REJEITADO", "PENDENTE_ENVIO", "EM_ANALISE", "APROVADO" }, docs.Select(d => d.Str("situacao")));
        Assert.Equal(new[] { true, true, false, false }, docs.Select(d => d.GetProperty("podeEnviar").GetBoolean()));
        Assert.Equal("Documento ilegível", docs[0].GetProperty("envioAtual").Str("motivoRejeicao"));
        Assert.Equal(JsonValueKind.Null, docs[1].GetProperty("envioAtual").ValueKind);
        Assert.Equal("Instruções do tipo", docs[1].GetProperty("tipoDocumento").Str("instrucoes"));
        Assert.All(docs.Where(d => d.GetProperty("envioAtual").ValueKind != JsonValueKind.Null),
            d => Assert.False(d.GetProperty("envioAtual").TryGetProperty("analisadoPor", out _)));
    }

    [Fact]
    public async Task Envio_de_pdf_fica_em_analise_e_grava_arquivo_sem_nome_original()
    {
        var (empresa, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync("Cartão CNPJ");
        var conteudo = ArquivosTeste.Pdf(5000);
        var r = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(conteudo, "cartão cnpj.pdf", contentType: "application/octet-stream"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var j = await r.LerAsync();
        Assert.Equal("EM_ANALISE", j.Str("status"));
        Assert.Equal("application/pdf", j.Str("formato"));
        Assert.Equal(5000, j.GetProperty("tamanhoBytes").GetInt64());
        Assert.Equal("cartão cnpj.pdf", j.Str("nomeArquivo"));
        Assert.Equal(tipo.Id, j.Id("tipoDocumentoId"));
        Assert.False(j.TryGetProperty("analisadoPor", out _));
        Assert.False(j.TryGetProperty("empresaId", out _));

        var envioId = j.Id();
        var caminho = Path.Combine(Api.DiretorioArquivos, "empresas", empresa.Id.ToString("N"), envioId.ToString("N"));
        Assert.True(File.Exists(caminho));
        Assert.Equal(conteudo, await File.ReadAllBytesAsync(caminho));
        Assert.Empty(Directory.GetFiles(Api.DiretorioArquivos, "*cart*", SearchOption.AllDirectories));

        var registro = await Api.NoBancoAsync(db => db.Envios.AsNoTracking().SingleAsync(e => e.Id == envioId));
        Assert.Equal(64, registro.Sha256.Length);
        Assert.DoesNotContain("cart", registro.ChaveArmazenamento);

        var docs = await (await c.GetAsync("/api/portal/documentos")).LerAsync();
        Assert.Equal("EM_ANALISE", docs[0].Str("situacao"));
        Assert.False(docs[0].GetProperty("podeEnviar").GetBoolean());
        Assert.Equal(1, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "DOCUMENTO_ENVIADO")));
    }

    [Fact]
    public async Task Png_e_jpeg_aceitos()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var t1 = await Semente.TipoAsync();
        var t2 = await Semente.TipoAsync();
        var png = await (await c.PostAsync($"/api/portal/documentos/{t1.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Png(), "foto.png", contentType: "image/png"))).LerAsync();
        Assert.Equal("image/png", png.Str("formato"));
        var jpg = await (await c.PostAsync($"/api/portal/documentos/{t2.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Jpeg(), "foto.jpg", contentType: "image/jpeg"))).LerAsync();
        Assert.Equal("image/jpeg", jpg.Str("formato"));
    }

    [Fact]
    public async Task Novo_envio_com_documento_em_analise_e_recusado()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
        var r = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()));
        Assert.Equal(HttpStatusCode.Conflict, r.StatusCode);
        Assert.Equal("ENVIO_NAO_PERMITIDO", await r.CodigoAsync());
        Assert.Equal("Este documento já está em análise ou aprovado.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Arquivo_acima_de_10_mb_devolve_413()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        var r = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf(10_485_761)));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, r.StatusCode);
        Assert.Equal("ARQUIVO_MUITO_GRANDE", await r.CodigoAsync());
        Assert.Equal("O arquivo passa de 10 MB.", (await r.LerAsync()).Str("title"));

        var exato = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf(10_485_760)));
        Assert.Equal(HttpStatusCode.Created, exato.StatusCode);
    }

    [Fact]
    public async Task Requisicao_muito_acima_do_limite_devolve_413()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        var r = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf(12 * 1024 * 1024)));
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, r.StatusCode);
        Assert.Equal("ARQUIVO_MUITO_GRANDE", await r.CodigoAsync());
    }

    [Fact]
    public async Task Exe_renomeado_para_pdf_devolve_415()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        var r = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Exe(), "documento.pdf"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, r.StatusCode);
        Assert.Equal("ARQUIVO_TIPO_NAO_SUPORTADO", await r.CodigoAsync());
        Assert.Equal("Envie um arquivo PDF, JPG ou PNG.", (await r.LerAsync()).Str("title"));
    }

    [Fact]
    public async Task Arquivo_truncado_com_cabecalho_valido_devolve_400_arquivo_invalido()
    {
        var (empresa, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        var truncados = new (byte[] Conteudo, string Nome, string Tipo)[]
        {
            (ArquivosTeste.Truncar(ArquivosTeste.Pdf(5000), 3000), "cortado.pdf", "application/pdf"),
            (ArquivosTeste.Truncar(ArquivosTeste.Png(), 50), "cortado.png", "image/png"),
            (ArquivosTeste.Truncar(ArquivosTeste.Jpeg(), 20), "cortado.jpg", "image/jpeg"),
        };
        foreach (var (conteudo, nome, tipoConteudo) in truncados)
        {
            var r = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(conteudo, nome, contentType: tipoConteudo));
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            Assert.Equal("ARQUIVO_INVALIDO", await r.CodigoAsync());
            Assert.Equal("Não conseguimos ler este arquivo.", (await r.LerAsync()).Str("title"));
        }

        // nada gravado: nem registro, nem arquivo em disco, nem auditoria de envio
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Envios.CountAsync(e => e.EmpresaId == empresa.Id)));
        Assert.False(Directory.Exists(Path.Combine(Api.DiretorioArquivos, "empresas", empresa.Id.ToString("N"))));
        Assert.Equal(0, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "DOCUMENTO_ENVIADO")));

        // o arquivo inteiro continua aceito, e assinatura desconhecida continua 415
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf(5000)))).StatusCode);
        var exe = await c.PostAsync($"/api/portal/documentos/{(await Semente.TipoAsync()).Id}/envios", ArquivosTeste.Form(ArquivosTeste.Exe(), "documento.pdf"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, exe.StatusCode);
    }

    [Fact]
    public async Task Pdf_com_atualizacao_incremental_e_bytes_apos_eof_e_aceito()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        var pdf = System.Text.Encoding.ASCII.GetBytes(
            "%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n2 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\r\n\0\0 ");
        var r = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(pdf));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.Equal("application/pdf", (await r.LerAsync()).Str("formato"));
    }

    [Fact]
    public async Task Arquivo_vazio_e_campo_ausente()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        var vazio = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form([]));
        Assert.Equal(HttpStatusCode.BadRequest, vazio.StatusCode);
        Assert.Equal("ARQUIVO_INVALIDO", await vazio.CodigoAsync());

        var semCampo = await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf(), campo: "outro"));
        Assert.Equal(HttpStatusCode.BadRequest, semCampo.StatusCode);
        Assert.Equal("VALIDACAO", await semCampo.CodigoAsync());
        Assert.True((await semCampo.LerAsync()).GetProperty("errors").TryGetProperty("arquivo", out _));

        var semForm = await c.PostAsJsonAsync($"/api/portal/documentos/{tipo.Id}/envios", new { });
        Assert.Equal(HttpStatusCode.BadRequest, semForm.StatusCode);
        Assert.Equal("VALIDACAO", await semForm.CodigoAsync());
    }

    [Fact]
    public async Task Tipo_inativo_ou_inexistente_devolve_404()
    {
        var (_, c) = await EmpresaLogadaAsync();
        var inativo = await Semente.TipoAsync(ativo: false);
        var r1 = await c.PostAsync($"/api/portal/documentos/{inativo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()));
        Assert.Equal(HttpStatusCode.NotFound, r1.StatusCode);
        Assert.Equal("NAO_ENCONTRADO", await r1.CodigoAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsync($"/api/portal/documentos/{Guid.NewGuid()}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/api/portal/documentos/{Guid.NewGuid()}/envios")).StatusCode);
    }

    [Fact]
    public async Task Envios_simultaneos_para_o_mesmo_tipo_um_passa_e_outro_409()
    {
        var (empresa, token) = await Semente.EmpresaComAcessoAsync();
        var tipo = await Semente.TipoAsync();
        var respostas = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ =>
            Api.Cliente(token: token).PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf(200_000)))));
        Assert.Equal(1, respostas.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(3, respostas.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, await Api.NoBancoAsync(db => db.Envios.CountAsync(e => e.EmpresaId == empresa.Id)));
        // o arquivo do perdedor é excluído (só sobra o do vencedor)
        Assert.Single(Directory.GetFiles(Path.Combine(Api.DiretorioArquivos, "empresas", empresa.Id.ToString("N"))));
    }

    [Fact]
    public async Task Historico_em_ordem_decrescente_e_download_do_proprio_arquivo()
    {
        var (empresa, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        var primeiro = await Semente.EnvioAsync(empresa, tipo, StatusEnvio.REJEITADO, "Documento vencido");
        var conteudo = ArquivosTeste.Pdf(3333);
        var segundo = await (await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(conteudo, "novo cartão.pdf"))).LerAsync();

        var hist = await (await c.GetAsync($"/api/portal/documentos/{tipo.Id}/envios")).LerAsync();
        Assert.Equal(2, hist.GetArrayLength());
        Assert.Equal(segundo.Id(), hist[0].Id());
        Assert.Equal(primeiro.Id, hist[1].Id());
        Assert.Equal("Documento vencido", hist[1].Str("motivoRejeicao"));
        Assert.False(hist[1].TryGetProperty("analisadoPor", out _));

        var r = await c.GetAsync($"/api/portal/envios/{segundo.Id()}/arquivo");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("application/pdf", r.Content.Headers.ContentType!.MediaType);
        Assert.Equal("attachment; filename*=UTF-8''novo%20cart%C3%A3o.pdf", r.Content.Headers.ContentDisposition!.ToString());
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.True(r.Headers.CacheControl!.NoStore);
        Assert.Equal(conteudo, await r.Content.ReadAsByteArrayAsync());
        Assert.Equal(1, await Api.NoBancoAsync(db => db.Auditoria.CountAsync(a => a.Acao == "ARQUIVO_BAIXADO" && a.AtorTipo == "EMPRESA")));
    }

    [Fact]
    public async Task Envio_depois_de_rejeicao_e_permitido()
    {
        var (empresa, c) = await EmpresaLogadaAsync();
        var tipo = await Semente.TipoAsync();
        await Semente.EnvioAsync(empresa, tipo, StatusEnvio.REJEITADO);
        Assert.Equal(HttpStatusCode.Created, (await c.PostAsync($"/api/portal/documentos/{tipo.Id}/envios", ArquivosTeste.Form(ArquivosTeste.Pdf()))).StatusCode);
    }
}
