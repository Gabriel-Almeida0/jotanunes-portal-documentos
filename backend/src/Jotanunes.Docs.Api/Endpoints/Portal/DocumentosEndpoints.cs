using System.Globalization;
using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Application.Envios;
using Jotanunes.Docs.Application.Envios.Recebimento;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Domain.Envios;
using Microsoft.AspNetCore.Mvc;

namespace Jotanunes.Docs.Api.Endpoints.Portal;

public static class DocumentosEndpoints
{
    /// <summary>Limite do corpo da requisição de upload (arquivo de 10 MB + overhead do multipart).</summary>
    public const long LimiteRequisicaoUpload = 11 * 1024 * 1024;

    public static RouteGroupBuilder MapDocumentosPortal(this RouteGroupBuilder g)
    {
        var completo = g.MapGroup("").RequireAuthorization(Politicas.PortalCompleto);

        completo.MapGet("/documentos", async (ListarDocumentosPortal uc, CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(ct)))
            .WithName("portalListarDocumentos");

        completo.MapGet("/documentos/{tipoDocumentoId}/envios",
            async (Guid tipoDocumentoId, DateOnly? periodoInicio, ListarHistoricoPortal uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(tipoDocumentoId, periodoInicio, ct))).WithName("portalListarHistoricoEnvios");

        completo.MapGet("/documentos/{tipoDocumentoId}/periodos", async (Guid tipoDocumentoId, ListarPeriodosPortal uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(tipoDocumentoId, ct))).WithName("portalListarPeriodos");

        completo.MapPost("/documentos/{tipoDocumentoId}/envios",
                (Guid tipoDocumentoId, HttpRequest req, ReceberDocumentoPortal uc, CancellationToken ct) =>
                    ReceberAsync(req, uc, tipoDocumentoId, obraId: null, $"/api/portal/documentos/{tipoDocumentoId}/envios", ct))
            .ComLimiteDeUpload()
            .WithName("portalEnviarDocumento");

        // ── Documentos por obra (002): {obraId} só entre obras ativas com vínculo ativo da empresa do token ──
        completo.MapGet("/obras", async (ListarObrasPortal uc, CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(ct)))
            .WithName("portalListarObras");

        completo.MapGet("/obras/{obraId}/documentos", async (Guid obraId, ListarDocumentosObraPortal uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(obraId, ct))).WithName("portalListarDocumentosObra");

        completo.MapGet("/obras/{obraId}/documentos/{tipoDocumentoId}/envios",
            async (Guid obraId, Guid tipoDocumentoId, DateOnly? periodoInicio, ListarHistoricoObraPortal uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(obraId, tipoDocumentoId, periodoInicio, ct))).WithName("portalListarHistoricoObra");

        completo.MapGet("/obras/{obraId}/documentos/{tipoDocumentoId}/periodos",
            async (Guid obraId, Guid tipoDocumentoId, ListarPeriodosObraPortal uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(obraId, tipoDocumentoId, ct))).WithName("portalListarPeriodosObra");

        completo.MapPost("/obras/{obraId}/documentos/{tipoDocumentoId}/envios",
                (Guid obraId, Guid tipoDocumentoId, HttpRequest req, ReceberDocumentoPortal uc, CancellationToken ct) =>
                    ReceberAsync(req, uc, tipoDocumentoId, obraId, $"/api/portal/obras/{obraId}/documentos/{tipoDocumentoId}/envios", ct))
            .ComLimiteDeUpload()
            .WithName("portalEnviarDocumentoObra");

        completo.MapGet("/envios/{envioId}/arquivo", async (Guid envioId, HttpContext ctx, BaixarArquivoPortal uc, CancellationToken ct) =>
            Arquivos.Baixar(ctx, await uc.ExecutarAsync(envioId, ct))).WithName("portalBaixarArquivoEnvio");
        return g;
    }

    private static RouteHandlerBuilder ComLimiteDeUpload(this RouteHandlerBuilder b) => b
        .WithMetadata(new RequestSizeLimitAttribute(LimiteRequisicaoUpload))
        .WithMetadata(new RequestFormLimitsAttribute { MultipartBodyLengthLimit = LimiteRequisicaoUpload });

    /// <summary>Etapas 1 e 2 já passaram (política e limite de upload): lê o formulário e entrega ao orquestrador.</summary>
    private static async Task<IResult> ReceberAsync(HttpRequest req, ReceberDocumentoPortal uc, Guid tipoDocumentoId, Guid? obraId,
        string location, CancellationToken ct)
    {
        var (arquivo, periodoInicio) = await ArquivoDoFormularioAsync(req, ct);
        await using var conteudo = arquivo.OpenReadStream();
        var pedido = new PedidoDeEnvio(tipoDocumentoId, obraId, periodoInicio, conteudo, arquivo.FileName);
        var envio = await uc.ExecutarAsync(pedido, ct);
        return Results.Created(location, envio);
    }

    /// <summary>Arquivo (campo <c>arquivo</c>) e período (campo opcional <c>periodoInicio</c>, <c>yyyy-MM-dd</c>; 003 research R7).</summary>
    private static async Task<(IFormFile Arquivo, DateOnly? PeriodoInicio)> ArquivoDoFormularioAsync(HttpRequest req, CancellationToken ct)
    {
        if (!req.HasFormContentType) throw ErroAplicacao.Validacao("arquivo", "Envie o arquivo no campo \"arquivo\".");
        var form = await req.ReadFormAsync(ct);
        var arquivo = form.Files.GetFile("arquivo") ?? throw ErroAplicacao.Validacao("arquivo", "Envie o arquivo no campo \"arquivo\".");
        if (arquivo.Length > EnvioDocumento.TamanhoMaximoBytes) throw new ErroAplicacao(CodigoErro.ARQUIVO_MUITO_GRANDE);
        DateOnly? periodoInicio = null;
        var texto = form["periodoInicio"].ToString();
        if (!string.IsNullOrWhiteSpace(texto))
        {
            if (!DateOnly.TryParseExact(texto.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            {
                throw ErroAplicacao.Validacao("periodoInicio", "Informe o início do período no formato AAAA-MM-DD.");
            }
            periodoInicio = d;
        }
        return (arquivo, periodoInicio);
    }
}
