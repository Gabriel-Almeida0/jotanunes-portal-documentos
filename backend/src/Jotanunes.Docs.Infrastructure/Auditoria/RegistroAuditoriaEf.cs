using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Infrastructure.Persistencia;

namespace Jotanunes.Docs.Infrastructure.Auditoria;

/// <summary>
/// Adiciona o registro ao contexto: é gravado na mesma transação do caso de uso. Para ator FLUIG, o perfil
/// (<c>ator_admin</c>) vem de <see cref="IUsuarioFluigAtual.EhAdmin"/>; nos outros casos fica nulo.
/// </summary>
public sealed class RegistroAuditoriaEf(DocsDbContext db, IContextoRequisicao contexto, TimeProvider relogio, IUsuarioFluigAtual usuarioFluig)
    : IRegistroAuditoria
{
    public void Registrar(string atorTipo, string? atorId, string acao, string? recursoTipo = null, string? recursoId = null)
    {
        bool? atorAdmin = atorTipo == AtorAuditoria.Fluig ? usuarioFluig.EhAdmin : null;
        db.Auditoria.Add(new RegistroAuditoria(relogio.GetUtcNow(), atorTipo, atorId, acao, recursoTipo, recursoId, Limitar(contexto.Ip, 45), atorAdmin));
    }

    private static string? Limitar(string? v, int max) => v is null ? null : v.Length > max ? v[..max] : v;
}
