using Jotanunes.Docs.Api.Infra;
using Jotanunes.Docs.Application.AcessoJotanunes;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Painel;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

/// <summary>
/// Sessão da área Jotanunes (research R17). Mapeadas num grupo <c>/api/fluig</c> próprio, com a política
/// <c>FluigSessao</c> (autenticado, SEM exigir a troca de senha): as políticas do grupo se somam às do endpoint, então
/// estas rotas não podem ficar no grupo principal (política <c>Fluig</c>, que exige a senha local definida).
/// </summary>
public static class AcessoJotanunesEndpoints
{
    public static RouteGroupBuilder MapSessaoJotanunes(this RouteGroupBuilder g)
    {
        g.MapGet("/me", async (ObterUsuarioFluig uc, CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(ct)))
            .WithName("fluigObterUsuarioAtual");

        g.MapGet("/auth/configuracao", (HttpContext http, ObterConfiguracaoAcesso uc) =>
            {
                http.Response.Headers.CacheControl = "no-store";
                return Results.Ok(uc.Executar());
            })
            .AllowAnonymous().WithName("fluigObterConfiguracaoAcesso");

        // Mesmo balde por IP das rotas anônimas do portal: alternar portal e área Jotanunes não dá mais tentativas.
        g.MapPost("/auth/login", async (LoginJotanunesInput entrada, LoginJotanunes uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(entrada, ct)))
            .AllowAnonymous().RequireRateLimiting(LimiteRequisicoes.PoliticaAnonima).WithName("fluigLogin");

        g.MapPost("/auth/trocar-senha", async (TrocaSenhaInput entrada, TrocarSenhaJotanunes uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(entrada, ct)))
            .WithName("fluigTrocarSenha");

        g.MapPost("/auth/sair", async (SairJotanunes uc, CancellationToken ct) =>
            {
                await uc.ExecutarAsync(ct);
                return Results.NoContent();
            })
            .WithName("fluigSair");
        return g;
    }
}
