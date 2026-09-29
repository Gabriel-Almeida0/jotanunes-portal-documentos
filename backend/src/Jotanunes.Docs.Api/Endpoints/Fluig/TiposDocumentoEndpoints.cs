using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.TiposDocumento;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

public static class TiposDocumentoEndpoints
{
    public static RouteGroupBuilder MapTiposDocumento(this RouteGroupBuilder g)
    {
        g.MapGet("/tipos-documento", async (bool? ativo, ListarTipos uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(ativo, ct))).WithName("fluigListarTiposDocumento");

        g.MapPost("/tipos-documento", async (TipoDocumentoInput entrada, CriarTipo uc, CancellationToken ct) =>
        {
            var t = await uc.ExecutarAsync(entrada, ct);
            return Results.Created($"/api/fluig/tipos-documento/{t.Id}", t);
        }).WithName("fluigCriarTipoDocumento").RequireAuthorization(Politicas.FluigAdmin);

        g.MapGet("/tipos-documento/{tipoDocumentoId}", async (Guid tipoDocumentoId, ObterTipo uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(tipoDocumentoId, ct))).WithName("fluigObterTipoDocumento");

        g.MapPut("/tipos-documento/{tipoDocumentoId}", async (Guid tipoDocumentoId, TipoDocumentoInput entrada, AtualizarTipo uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(tipoDocumentoId, entrada, ct))).WithName("fluigAtualizarTipoDocumento").RequireAuthorization(Politicas.FluigAdmin);
        return g;
    }
}
