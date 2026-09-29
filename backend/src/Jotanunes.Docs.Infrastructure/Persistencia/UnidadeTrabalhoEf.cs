using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Jotanunes.Docs.Infrastructure.Persistencia;

public sealed class UnidadeTrabalhoEf(DocsDbContext db) : IUnidadeTrabalho
{
    public async Task SalvarAsync(CancellationToken ct = default)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ErroUnicidade.Traduzir(ex) is { } erro)
        {
            throw erro;
        }
    }

    public async Task<ITransacao> IniciarTransacaoAsync(CancellationToken ct = default) =>
        new TransacaoEf(await db.Database.BeginTransactionAsync(ct));

    private sealed class TransacaoEf(IDbContextTransaction tx) : ITransacao
    {
        private bool _finalizada;

        public async Task ConfirmarAsync(CancellationToken ct = default)
        {
            await tx.CommitAsync(ct);
            _finalizada = true;
        }

        public async Task DesfazerAsync(CancellationToken ct = default)
        {
            if (_finalizada) return;
            await tx.RollbackAsync(ct);
            _finalizada = true;
        }

        public async ValueTask DisposeAsync()
        {
            if (!_finalizada)
            {
                try { await tx.RollbackAsync(); } catch (InvalidOperationException) { }
            }
            await tx.DisposeAsync();
        }
    }
}

internal static class ErroUnicidade
{
    public const string ViolacaoUnicidade = "23505";

    public static bool EhViolacao(DbUpdateException ex, string? constraint = null) =>
        ex.InnerException is PostgresException { SqlState: ViolacaoUnicidade } pg
        && (constraint is null || pg.ConstraintName == constraint);

    public static ErroAplicacao? Traduzir(DbUpdateException ex)
    {
        if (ex.InnerException is not PostgresException { SqlState: ViolacaoUnicidade } pg) return null;
        return pg.ConstraintName switch
        {
            DocsDbContext.IndiceCnpj => new ErroAplicacao(CodigoErro.CNPJ_DUPLICADO),
            DocsDbContext.IndiceCodigoObra => new ErroAplicacao(CodigoErro.CODIGO_OBRA_DUPLICADO),
            DocsDbContext.IndiceNomeTipo => new ErroAplicacao(CodigoErro.NOME_DUPLICADO),
            DocsDbContext.IndiceEnvioVivo => new ErroAplicacao(CodigoErro.ENVIO_NAO_PERMITIDO),
            DocsDbContext.IndiceLoginUsuario => new ErroAplicacao(CodigoErro.LOGIN_DUPLICADO),
            _ => null,
        };
    }
}
