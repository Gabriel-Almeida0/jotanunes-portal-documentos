using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.UsuariosInternos;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Infrastructure.Persistencia.Repositorios;

/// <summary>
/// Usuários internos (data-model §10). O login é gravado e procurado em minúsculas; o índice único <c>lower(login)</c>
/// garante a unicidade sob concorrência (violação → LOGIN_DUPLICADO na unidade de trabalho).
/// </summary>
public sealed class UsuarioInternoRepositorio(DocsDbContext db) : IUsuarioInternoRepositorio
{
    public Task<UsuarioInterno?> ObterAsync(Guid id, CancellationToken ct = default) =>
        db.UsuariosInternos.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<UsuarioInterno?> ObterPorLoginAsync(string loginNormalizado, CancellationToken ct = default) =>
        db.UsuariosInternos.FirstOrDefaultAsync(u => u.Login.ToLower() == loginNormalizado, ct);

    public async Task<PaginaResultado<UsuarioInterno>> ListarAsync(FiltroUsuariosInternos f, Paginacao p, CancellationToken ct = default)
    {
        var q = db.UsuariosInternos.AsNoTracking();
        if (f.Busca is not null)
        {
            var padrao = Busca.Contem(f.Busca);
            q = q.Where(u => EF.Functions.ILike(EF.Functions.Unaccent(u.Nome), EF.Functions.Unaccent(padrao))
                          || EF.Functions.ILike(u.Login, padrao)
                          || EF.Functions.ILike(u.Email, padrao));
        }
        if (f.Ativo is { } ativo) q = q.Where(u => u.Ativo == ativo);
        if (f.Admin is { } admin) q = q.Where(u => u.Admin == admin);

        var total = await q.CountAsync(ct);
        var itens = await q.OrderBy(u => EF.Functions.Unaccent(u.Nome.ToLower())).ThenBy(u => u.Login).Skip(p.Pular).Take(p.TamanhoPagina).ToListAsync(ct);
        return new PaginaResultado<UsuarioInterno>(itens, total, p.Pagina, p.TamanhoPagina);
    }

    public Task<int> ContarAdministradoresAtivosAsync(CancellationToken ct = default) =>
        db.UsuariosInternos.CountAsync(u => u.Admin && u.Ativo, ct);

    public void Adicionar(UsuarioInterno usuario) => db.UsuariosInternos.Add(usuario);
}
