using Jotanunes.Docs.Application.Dtos;

namespace Jotanunes.Docs.Api.Endpoints;

internal static class Arquivos
{
    /// <summary>Resposta de download com os headers do contrato (attachment, nosniff, no-store).</summary>
    public static IResult Baixar(HttpContext ctx, ArquivoDto arquivo)
    {
        var h = ctx.Response.Headers;
        h.ContentDisposition = $"attachment; filename*=UTF-8''{Uri.EscapeDataString(arquivo.NomeArquivo)}";
        h.XContentTypeOptions = "nosniff";
        h.CacheControl = "no-store";
        return Results.Stream(arquivo.Conteudo, arquivo.ContentType);
    }
}
