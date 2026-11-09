using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Envios;
using Jotanunes.Docs.Application.Obras;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

public static class ObrasEndpoints
{
    public static RouteGroupBuilder MapObras(this RouteGroupBuilder g)
    {
        g.MapGet("/obras", async (string? busca, bool? ativa, bool? comPendencia, int? pagina, int? tamanhoPagina, ListarObras uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(busca, ativa, comPendencia, pagina, tamanhoPagina, ct))).WithName("fluigListarObras");

        g.MapPost("/obras", async (ObraInput entrada, CriarObra uc, CancellationToken ct) =>
        {
            var obra = await uc.ExecutarAsync(entrada, ct);
            return Results.Created($"/api/fluig/obras/{obra.Id}", obra);
        }).WithName("fluigCriarObra").RequireAuthorization(Politicas.FluigAdmin);

        g.MapGet("/obras/{obraId}", async (Guid obraId, ObterObra uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(obraId, ct))).WithName("fluigObterObra");

        g.MapPut("/obras/{obraId}", async (Guid obraId, ObraInput entrada, AtualizarObra uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(obraId, entrada, ct))).WithName("fluigAtualizarObra").RequireAuthorization(Politicas.FluigAdmin);

        g.MapPut("/obras/{obraId}/empresas/{empresaId}", async (Guid obraId, Guid empresaId, VincularEmpresa uc, CancellationToken ct) =>
        {
            await uc.ExecutarAsync(obraId, empresaId, ct);
            return Results.NoContent();
        }).WithName("fluigVincularEmpresaObra").RequireAuthorization(Politicas.FluigAdmin);

        g.MapDelete("/obras/{obraId}/empresas/{empresaId}", async (Guid obraId, Guid empresaId, DesvincularEmpresa uc, CancellationToken ct) =>
        {
            await uc.ExecutarAsync(obraId, empresaId, ct);
            return Results.NoContent();
        }).WithName("fluigDesvincularEmpresaObra").RequireAuthorization(Politicas.FluigAdmin);

        // ── Documentos por obra (002) ──
        g.MapGet("/obras/{obraId}/tipos-documento", async (Guid obraId, ListarTiposExigidosObra uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(obraId, ct))).WithName("fluigListarTiposExigidosObra");

        g.MapPut("/obras/{obraId}/tipos-documento/{tipoDocumentoId}", async (Guid obraId, Guid tipoDocumentoId, MarcarTipoExigidoObra uc, CancellationToken ct) =>
        {
            await uc.ExecutarAsync(obraId, tipoDocumentoId, ct);
            return Results.NoContent();
        }).WithName("fluigMarcarTipoExigidoObra").RequireAuthorization(Politicas.FluigAdmin);

        g.MapDelete("/obras/{obraId}/tipos-documento/{tipoDocumentoId}", async (Guid obraId, Guid tipoDocumentoId, DesmarcarTipoExigidoObra uc, CancellationToken ct) =>
        {
            await uc.ExecutarAsync(obraId, tipoDocumentoId, ct);
            return Results.NoContent();
        }).WithName("fluigDesmarcarTipoExigidoObra").RequireAuthorization(Politicas.FluigAdmin);

        g.MapGet("/obras/{obraId}/empresas/{empresaId}/documentos", async (Guid obraId, Guid empresaId, ListarDocumentosEmpresaObra uc, CancellationToken ct) =>
            Results.Ok(await uc.ExecutarAsync(obraId, empresaId, ct))).WithName("fluigListarDocumentosEmpresaObra");

        g.MapGet("/obras/{obraId}/empresas/{empresaId}/documentos/{tipoDocumentoId}/envios",
            async (Guid obraId, Guid empresaId, Guid tipoDocumentoId, DateOnly? periodoInicio, ListarHistoricoEnviosEmpresaObra uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(obraId, empresaId, tipoDocumentoId, periodoInicio, ct))).WithName("fluigListarHistoricoEnviosEmpresaObra");

        g.MapGet("/obras/{obraId}/empresas/{empresaId}/documentos/{tipoDocumentoId}/periodos",
            async (Guid obraId, Guid empresaId, Guid tipoDocumentoId, ListarPeriodosEmpresaObra uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(obraId, empresaId, tipoDocumentoId, ct))).WithName("fluigListarPeriodosEmpresaObra");
        return g;
    }
}
