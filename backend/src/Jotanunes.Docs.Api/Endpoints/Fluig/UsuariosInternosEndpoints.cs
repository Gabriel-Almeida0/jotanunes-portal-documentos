using Jotanunes.Docs.Api.Autenticacao;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.UsuariosInternos;

namespace Jotanunes.Docs.Api.Endpoints.Fluig;

/// <summary>Usuários internos do login próprio: TODAS as rotas são <c>x-requer-admin</c>, inclusive as de leitura.</summary>
public static class UsuariosInternosEndpoints
{
    public static RouteGroupBuilder MapUsuariosInternos(this RouteGroupBuilder g)
    {
        g.MapGet("/usuarios", async (string? busca, bool? ativo, bool? admin, int? pagina, int? tamanhoPagina, ListarUsuariosInternos uc,
                CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(busca, ativo, admin, pagina, tamanhoPagina, ct)))
            .WithName("fluigListarUsuariosInternos").RequireAuthorization(Politicas.FluigAdmin);

        g.MapPost("/usuarios", async (UsuarioInternoInput entrada, CriarUsuarioInterno uc, CancellationToken ct) =>
            {
                var usuario = await uc.ExecutarAsync(entrada, ct);
                return Results.Created($"/api/fluig/usuarios/{usuario.Id}", usuario);
            })
            .WithName("fluigCriarUsuarioInterno").RequireAuthorization(Politicas.FluigAdmin);

        g.MapGet("/usuarios/{usuarioId}", async (Guid usuarioId, ObterUsuarioInterno uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(usuarioId, ct)))
            .WithName("fluigObterUsuarioInterno").RequireAuthorization(Politicas.FluigAdmin);

        g.MapPut("/usuarios/{usuarioId}", async (Guid usuarioId, UsuarioInternoAtualizacao entrada, AtualizarUsuarioInterno uc,
                CancellationToken ct) => Results.Ok(await uc.ExecutarAsync(usuarioId, entrada, ct)))
            .WithName("fluigAtualizarUsuarioInterno").RequireAuthorization(Politicas.FluigAdmin);

        g.MapPost("/usuarios/{usuarioId}/redefinir-senha", async (Guid usuarioId, RedefinirSenhaUsuarioInterno uc, CancellationToken ct) =>
                Results.Ok(await uc.ExecutarAsync(usuarioId, ct)))
            .WithName("fluigRedefinirSenhaUsuarioInterno").RequireAuthorization(Politicas.FluigAdmin);
        return g;
    }
}
