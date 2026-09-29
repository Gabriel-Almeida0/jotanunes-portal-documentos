using Jotanunes.Docs.Application.Portas;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Infrastructure.Persistencia;

/// <summary>
/// <c>pg_advisory_xact_lock</c> na conexão do <see cref="DocsDbContext"/>: espera o bloqueio e o mantém até o commit
/// ou rollback da transação aberta pela unidade de trabalho (research R15).
/// </summary>
public sealed class BloqueioExclusivoPostgres(DocsDbContext db) : IBloqueioExclusivo
{
    public async Task AdquirirAsync(long chave, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is null)
        {
            throw new InvalidOperationException("O bloqueio exclusivo exige uma transação aberta pela unidade de trabalho.");
        }
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({chave})", ct);
    }
}
