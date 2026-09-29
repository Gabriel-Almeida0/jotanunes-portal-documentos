using Jotanunes.Docs.Application.Convites;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

public static class ConvitesEndpoints
{
    public static RouteGroupBuilder MapConvites(this RouteGroupBuilder g)
    {
        g.MapGet("/empresas/{empresaId}/convites", async (Guid empresaId, ListarConvites uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(empresaId, ct))).WithName("fluigListarConvites");

        g.MapPost("/empresas/{empresaId}/convites", async (Guid empresaId, EnviarConvite uc, CancellationToken ct) =>
        {
            var convite = await uc.ExecutarAsync(empresaId, ct);
            return Results.Created($"/api/fluig/empresas/{empresaId}/convites", convite);
        }).WithName("fluigEnviarConvite");
        return g;
    }
}
