using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Empresas;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

public static class EmpresasEndpoints
{
    public static RouteGroupBuilder MapEmpresas(this RouteGroupBuilder g)
    {
        g.MapGet("/empresas", async (string? busca, Guid? obraId, string? situacaoAcesso, bool? comPendencia, int? pagina, int? tamanhoPagina,
                ListarEmpresas uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(busca, obraId, situacaoAcesso, comPendencia, pagina, tamanhoPagina, ct)))
            .WithName("fluigListarEmpresas");

        g.MapPost("/empresas", async (EmpresaInput entrada, CriarEmpresa uc, CancellationToken ct) =>
        {
            var e = await uc.ExecutarAsync(entrada, ct);
            return Results.Created($"/api/fluig/empresas/{e.Id}", e);
        }).WithName("fluigCriarEmpresa").RequireAuthorization(Politicas.FluigAdmin);

        g.MapGet("/empresas/{empresaId}", async (Guid empresaId, ObterEmpresa uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(empresaId, ct))).WithName("fluigObterEmpresa");

        g.MapPut("/empresas/{empresaId}", async (Guid empresaId, EmpresaInput entrada, AtualizarEmpresa uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(empresaId, entrada, ct))).WithName("fluigAtualizarEmpresa").RequireAuthorization(Politicas.FluigAdmin);
        return g;
    }
}
