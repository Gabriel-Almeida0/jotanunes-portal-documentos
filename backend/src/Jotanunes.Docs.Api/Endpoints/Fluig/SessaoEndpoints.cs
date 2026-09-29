using Jotanunes.Docs.Application.Painel;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

public static class SessaoEndpoints
{
    public static RouteGroupBuilder MapSessaoFluig(this RouteGroupBuilder g)
    {
        g.MapGet("/me", (ObterUsuarioFluig uc) => Results.Ok(uc.Executar())).WithName("fluigObterUsuarioAtual");
        g.MapGet("/painel", async (ObterPainel uc, CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(ct))).WithName("fluigObterPainel");
        return g;
    }
}
