using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Infrastructure.Persistencia;

namespace Jotanunes.Docs.Infrastructure.Auditoria;

/// <summary>
/// Adiciona o registro ao contexto: é gravado na mesma transação do caso de uso. Ator FLUIG numa sessão de login
/// próprio vira LOCAL (os casos de uso da área Jotanunes não distinguem a origem). Para FLUIG/LOCAL, o perfil
/// (<c>ator_admin</c>) vem do parâmetro, se informado, ou de <see cref="IUsuarioFluigAtual.EhAdmin"/>; nos outros casos fica nulo.
/// Fora de uma requisição HTTP (comando <c>criar-admin</c>) não há sessão nem IP.
/// </summary>
public sealed class RegistroAuditoriaEf(DocsDbContext db, IContextoRequisicao contexto, TimeProvider relogio, IUsuarioFluigAtual usuarioFluig)
    : IRegistroAuditoria
{
    public void Registrar(string atorTipo, string? atorId, string acao, string? recursoTipo = null, string? recursoId = null, bool? atorAdmin = null)
    {
        if (atorTipo == AtorAuditoria.Fluig && usuarioFluig.EhLoginLocal) atorTipo = AtorAuditoria.Local;
        if (AtorAuditoria.TemPerfil(atorTipo)) atorAdmin ??= usuarioFluig.EhAdmin;
        db.Auditoria.Add(new RegistroAuditoria(relogio.GetUtcNow(), atorTipo, atorId, acao, recursoTipo, recursoId, Limitar(contexto.Ip, 45), atorAdmin));
    }

    private static string? Limitar(string? v, int max) => v is null ? null : v.Length > max ? v[..max] : v;
}
