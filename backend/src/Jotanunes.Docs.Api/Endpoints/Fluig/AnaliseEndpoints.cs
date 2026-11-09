using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Envios;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

public static class AnaliseEndpoints
{
    public static RouteGroupBuilder MapAnalise(this RouteGroupBuilder g)
    {
        g.MapGet("/envios", async (string? status, Guid? obraId, bool? somenteGerais, Guid? empresaId, Guid? tipoDocumentoId, bool? comAtraso,
                int? pagina, int? tamanhoPagina, ListarFilaEnvios uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(status, obraId, somenteGerais, empresaId, tipoDocumentoId, pagina, tamanhoPagina, comAtraso, ct)))
            .WithName("fluigListarEnvios");

        g.MapGet("/envios/{envioId}", async (Guid envioId, ObterEnvio uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(envioId, ct))).WithName("fluigObterEnvio");

        g.MapGet("/envios/{envioId}/arquivo", async (Guid envioId, HttpContext ctx, BaixarArquivoFluig uc, CancellationToken ct) =>
            Arquivos.Baixar(ctx, await uc.ExecutarAsync(envioId, ct))).WithName("fluigBaixarArquivoEnvio");

        g.MapPost("/envios/{envioId}/aprovar", async (Guid envioId, AprovarEnvio uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(envioId, ct))).WithName("fluigAprovarEnvio").RequireAuthorization(Politicas.FluigAdmin);

        g.MapPost("/envios/{envioId}/rejeitar", async (Guid envioId, RejeicaoInput entrada, RejeitarEnvio uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(envioId, entrada, ct))).WithName("fluigRejeitarEnvio").RequireAuthorization(Politicas.FluigAdmin);

        g.MapGet("/empresas/{empresaId}/documentos", async (Guid empresaId, ListarDocumentosEmpresa uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(empresaId, ct))).WithName("fluigListarDocumentosEmpresa");

        g.MapGet("/empresas/{empresaId}/documentos/{tipoDocumentoId}/envios",
            async (Guid empresaId, Guid tipoDocumentoId, DateOnly? periodoInicio, ListarHistoricoEnviosEmpresa uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(empresaId, tipoDocumentoId, periodoInicio, ct))).WithName("fluigListarHistoricoEnvios");

        g.MapGet("/empresas/{empresaId}/documentos/{tipoDocumentoId}/periodos",
            async (Guid empresaId, Guid tipoDocumentoId, ListarPeriodosEmpresa uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(empresaId, tipoDocumentoId, ct))).WithName("fluigListarPeriodosEmpresa");
        return g;
    }
}
