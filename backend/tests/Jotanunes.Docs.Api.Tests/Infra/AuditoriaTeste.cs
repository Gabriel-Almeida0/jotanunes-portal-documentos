using Jotanunes.Docs.Domain.Auditoria;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Api.Tests.Infra;

public static class AuditoriaTeste
{
    /// <summary>Linhas da auditoria com a ação informada, na ordem em que foram gravadas.</summary>
    public static Task<List<RegistroAuditoria>> LinhasAsync(ApiFactory api, string acao) =>
        api.NoBancoAsync(db => db.Auditoria.AsNoTracking().Where(a => a.Acao == acao).OrderBy(a => a.Id).ToListAsync());

    /// <summary>Única linha da auditoria com a ação informada.</summary>
    public static async Task<RegistroAuditoria> UnicaAsync(ApiFactory api, string acao) => Assert.Single(await LinhasAsync(api, acao));

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
