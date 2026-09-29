using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Api.Infra;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Portal;

namespace Jotanunes.Docs.Api.Endpoints.Portal;

public static class AcessoEndpoints
{
    public static RouteGroupBuilder MapAcessoPortal(this RouteGroupBuilder g)
    {
        g.MapGet("/convites/{token}", async (string token, ValidarConvite uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(token, ct)))
            .AllowAnonymous().RequireRateLimiting(LimiteRequisicoes.PoliticaAnonima).WithName("portalValidarConvite");

        g.MapPost("/auth/login", async (LoginInput entrada, LoginPortal uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(entrada, ct)))
            .AllowAnonymous().RequireRateLimiting(LimiteRequisicoes.PoliticaAnonima).WithName("portalLogin");

        g.MapPost("/auth/trocar-senha", async (TrocaSenhaInput entrada, TrocarSenha uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(entrada, ct)))
            .RequireAuthorization(Politicas.Portal).WithName("portalTrocarSenha");

        g.MapGet("/me", async (ObterEmpresaPortal uc, CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(ct)))
            .RequireAuthorization(Politicas.Portal).WithName("portalObterEmpresaAtual");
        return g;
    }
}
