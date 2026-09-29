using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Infrastructure.Persistencia.Consultas;

/// <summary>Filtros de empresa traduzidos para SQL, pela regra de data-model §2 e §6.</summary>
internal static class ConsultasEmpresa
{
    /// <summary>Empresas ativas com algum tipo ativo sem envio "vivo" (pendente de envio ou rejeitado).</summary>
    public static IQueryable<Empresa> ComPendencia(IQueryable<Empresa> q, DocsDbContext db) =>
        q.Where(e => e.Ativa && db.TiposDocumento.Any(t => t.Ativo
            && !db.Envios.Any(v => v.EmpresaId == e.Id && v.TipoDocumentoId == t.Id && v.Status != StatusEnvio.REJEITADO)));

    public static IQueryable<Empresa> SemPendencia(IQueryable<Empresa> q, DocsDbContext db) =>
        q.Where(e => !(e.Ativa && db.TiposDocumento.Any(t => t.Ativo
            && !db.Envios.Any(v => v.EmpresaId == e.Id && v.TipoDocumentoId == t.Id && v.Status != StatusEnvio.REJEITADO))));

    public static IQueryable<Empresa> ComSituacao(IQueryable<Empresa> q, SituacaoAcesso s, DateTimeOffset agora) => s switch
    {
        SituacaoAcesso.DESATIVADA => q.Where(e => !e.Ativa),
        SituacaoAcesso.NAO_CONVIDADA => q.Where(e => e.Ativa && e.SenhaHash == null),
        SituacaoAcesso.ATIVA => q.Where(e => e.Ativa && e.SenhaHash != null && !e.TrocaSenhaObrigatoria),
        SituacaoAcesso.CONVIDADA => q.Where(e => e.Ativa && e.SenhaHash != null && e.TrocaSenhaObrigatoria
            && (e.SenhaTemporariaExpiraEm == null || e.SenhaTemporariaExpiraEm > agora)),
        SituacaoAcesso.CONVITE_EXPIRADO => q.Where(e => e.Ativa && e.SenhaHash != null && e.TrocaSenhaObrigatoria
            && e.SenhaTemporariaExpiraEm != null && e.SenhaTemporariaExpiraEm <= agora),
        _ => q,
    };
}

public sealed class ConsultaDocumentosEf(DocsDbContext db) : IConsultaDocumentos
{
    private const int Aprovado = 3, EmAnalise = 2, Rejeitado = 1;

    public async Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarPorEmpresaAsync(IReadOnlyCollection<Guid> empresaIds, CancellationToken ct = default)
    {
        var resultado = new Dictionary<Guid, ContagemDocumentosDto>();
        if (empresaIds.Count == 0) return resultado;

        var totalAtivos = await db.TiposDocumento.CountAsync(t => t.Ativo, ct);
        var ids = empresaIds.Distinct().ToList();

        // Uma linha por (empresa, tipo ativo) com envios: prioridade do envio que define a situação.
        var linhas = await (from e in db.Envios.AsNoTracking()
                            join t in db.TiposDocumento.AsNoTracking() on e.TipoDocumentoId equals t.Id
                            where t.Ativo && ids.Contains(e.EmpresaId)
                            group e by new { e.EmpresaId, e.TipoDocumentoId } into g
                            select new
                            {
                                g.Key.EmpresaId,
                                Prioridade = g.Max(x => x.Status == StatusEnvio.APROVADO ? Aprovado : x.Status == StatusEnvio.EM_ANALISE ? EmAnalise : Rejeitado),
                            }).ToListAsync(ct);

        var porEmpresa = linhas.ToLookup(l => l.EmpresaId, l => l.Prioridade);
        foreach (var id in ids)
        {
            var p = porEmpresa[id].ToList();
            var aprovados = p.Count(x => x == Aprovado);
            var emAnalise = p.Count(x => x == EmAnalise);
            var rejeitados = p.Count(x => x == Rejeitado);
            resultado[id] = new ContagemDocumentosDto(totalAtivos, totalAtivos - aprovados - emAnalise - rejeitados, emAnalise, aprovados, rejeitados);
        }
        return resultado;
    }

    public async Task<PainelDto> ObterPainelAsync(DateTimeOffset agora, CancellationToken ct = default)
    {
        var enviosEmAnalise = await db.Envios.CountAsync(e => e.Status == StatusEnvio.EM_ANALISE, ct);
        var comPendencia = await ConsultasEmpresa.ComPendencia(db.Empresas.AsNoTracking(), db).CountAsync(ct);
        var convidadas = await ConsultasEmpresa.ComSituacao(db.Empresas.AsNoTracking(), SituacaoAcesso.CONVIDADA, agora).CountAsync(ct)
                         + await ConsultasEmpresa.ComSituacao(db.Empresas.AsNoTracking(), SituacaoAcesso.CONVITE_EXPIRADO, agora).CountAsync(ct);
        var empresasAtivas = await db.Empresas.CountAsync(e => e.Ativa, ct);
        var obrasAtivas = await db.Obras.CountAsync(o => o.Ativa, ct);
        return new PainelDto(enviosEmAnalise, comPendencia, convidadas, empresasAtivas, obrasAtivas);
    }
}
