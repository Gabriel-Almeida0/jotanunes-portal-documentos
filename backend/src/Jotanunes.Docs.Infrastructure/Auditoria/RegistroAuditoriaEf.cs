using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Infrastructure.Persistencia;

namespace Jotanunes.Docs.Infrastructure.Auditoria;

/// <summary>Adiciona o registro ao contexto: é gravado na mesma transação do caso de uso.</summary>
public sealed class RegistroAuditoriaEf(DocsDbContext db, IContextoRequisicao contexto, TimeProvider relogio) : IRegistroAuditoria
{
    public void Registrar(string atorTipo, string? atorId, string acao, string? recursoTipo = null, string? recursoId = null) =>
        db.Auditoria.Add(new RegistroAuditoria(relogio.GetUtcNow(), atorTipo, atorId, acao, recursoTipo, recursoId, Limitar(contexto.Ip, 45)));

    private static string? Limitar(string? v, int max) => v is null ? null : v.Length > max ? v[..max] : v;
}
