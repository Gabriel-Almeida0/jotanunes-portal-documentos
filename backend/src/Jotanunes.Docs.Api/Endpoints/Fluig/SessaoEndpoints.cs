using Jotanunes.Docs.Application.Painel;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

public static class SessaoEndpoints
{
    /// <summary>Painel (grupo com a política <c>Fluig</c>). O <c>GET /me</c> fica no grupo de sessão (<see cref="AcessoJotanunesEndpoints"/>).</summary>
    public static RouteGroupBuilder MapSessaoFluig(this RouteGroupBuilder g)
    {
        g.MapGet("/painel", async (Guid? obraId, ObterPainel uc, CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(obraId, ct)))
            .WithName("fluigObterPainel");
        return g;
    }
}
