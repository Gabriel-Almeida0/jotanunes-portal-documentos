using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Application.Envios;
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

        completo.MapGet("/documentos/{tipoDocumentoId}/envios", async (Guid tipoDocumentoId, ListarHistoricoPortal uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(tipoDocumentoId, ct))).WithName("portalListarHistoricoEnvios");

        completo.MapPost("/documentos/{tipoDocumentoId}/envios", async (Guid tipoDocumentoId, HttpRequest req, EnviarDocumento uc, CancellationToken ct) =>
            {
                if (!req.HasFormContentType) throw ErroAplicacao.Validacao("arquivo", "Envie o arquivo no campo \"arquivo\".");
                var form = await req.ReadFormAsync(ct);
                var arquivo = form.Files.GetFile("arquivo") ?? throw ErroAplicacao.Validacao("arquivo", "Envie o arquivo no campo \"arquivo\".");
                if (arquivo.Length > EnvioDocumento.TamanhoMaximoBytes) throw new ErroAplicacao(CodigoErro.ARQUIVO_MUITO_GRANDE);
                await using var conteudo = arquivo.OpenReadStream();
                var envio = await uc.ExecutarAsync(tipoDocumentoId, conteudo, arquivo.FileName, ct);
                return Results.Created($"/api/portal/documentos/{tipoDocumentoId}/envios", envio);
            })
            .WithMetadata(new RequestSizeLimitAttribute(LimiteRequisicaoUpload))
            .WithMetadata(new RequestFormLimitsAttribute { MultipartBodyLengthLimit = LimiteRequisicaoUpload })
            .WithName("portalEnviarDocumento");

        completo.MapGet("/envios/{envioId}/arquivo", async (Guid envioId, HttpContext ctx, BaixarArquivoPortal uc, CancellationToken ct) =>
            Arquivos.Baixar(ctx, await uc.ExecutarAsync(envioId, ct))).WithName("portalBaixarArquivoEnvio");
        return g;
    }
}
