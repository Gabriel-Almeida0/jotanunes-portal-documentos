using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Infra;

public static class AuditoriaTeste
{
    /// <summary>Nenhuma coluna de nenhuma linha da tabela <c>auditoria</c> contém os segredos informados.</summary>
    public static async Task SemSegredosAsync(ApiFactory api, IEnumerable<string> segredos)
    {
        var linhas = await api.NoBancoAsync(db =>
            db.Database.SqlQueryRaw<string>("SELECT row_to_json(a)::text AS \"Value\" FROM auditoria a").ToListAsync());
        Assert.NotEmpty(linhas);
        foreach (var segredo in segredos)
        {
            Assert.All(linhas, l => Assert.DoesNotContain(segredo, l));
        }
    }
}
