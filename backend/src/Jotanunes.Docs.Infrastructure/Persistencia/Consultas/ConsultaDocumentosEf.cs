using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Infrastructure.Persistencia.Consultas;

/// <summary>Filtros de empresa traduzidos para SQL, pela regra de data-model §2/§6 (001) e §5 (002).</summary>
internal static class ConsultasEmpresa
{
    /// <summary>
    /// Empresas ativas com algum documento sem envio "vivo" (pendente de envio ou rejeitado): geral (tipo GERAL ativo,
    /// envio sem obra) ou da obra (vínculo ativo em obra ativa, tipo marcado e ativo, envio daquela obra). Em SQL só os tipos
    /// únicos; os periódicos (períodos derivados) vêm calculados em <paramref name="comPendenciaPeriodica"/> (003 FR-321).
    /// </summary>
    public static IQueryable<Empresa> ComPendencia(IQueryable<Empresa> q, DocsDbContext db, IReadOnlyCollection<Guid> comPendenciaPeriodica)
    {
        var periodicas = comPendenciaPeriodica.ToList();
        return q.Where(e => e.Ativa
            && (periodicas.Contains(e.Id)
                || db.TiposDocumento.Any(t => t.Ativo && t.Abrangencia == Abrangencia.GERAL && t.PeriodicidadeUnidade == UnidadePeriodicidade.UNICA
                    && !db.Envios.Any(v => v.EmpresaId == e.Id && v.TipoDocumentoId == t.Id && v.ObraId == null && v.Status != StatusEnvio.REJEITADO))
                || db.ObraEmpresas.Any(oe => oe.EmpresaId == e.Id && oe.Ativo
                    && db.Obras.Any(o => o.Id == oe.ObraId && o.Ativa)
                    && db.ObraTiposDocumento.Any(m => m.ObraId == oe.ObraId
                        && db.TiposDocumento.Any(t => t.Id == m.TipoDocumentoId && t.Ativo && t.PeriodicidadeUnidade == UnidadePeriodicidade.UNICA)
                        && !db.Envios.Any(v => v.EmpresaId == e.Id && v.TipoDocumentoId == m.TipoDocumentoId && v.ObraId == oe.ObraId
                            && v.Status != StatusEnvio.REJEITADO)))));
    }

    public static IQueryable<Empresa> SemPendencia(IQueryable<Empresa> q, DocsDbContext db, IReadOnlyCollection<Guid> comPendenciaPeriodica)
    {
        var com = ComPendencia(db.Empresas, db, comPendenciaPeriodica).Select(e => e.Id);
        return q.Where(e => !com.Contains(e.Id));
    }

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

/// <summary>Filtro "obra com pendência" (002 data-model §5).</summary>
internal static class ConsultasObra
{
    /// <summary>
    /// Obras ativas com alguma empresa ativa (vínculo ativo) com documento da obra pendente de envio ou rejeitado. Em SQL só
    /// os tipos únicos; as obras com pendência periódica vêm calculadas em <paramref name="comPendenciaPeriodica"/>.
    /// </summary>
    public static IQueryable<Obra> ComPendencia(IQueryable<Obra> q, DocsDbContext db, IReadOnlyCollection<Guid> comPendenciaPeriodica)
    {
        var periodicas = comPendenciaPeriodica.ToList();
        return q.Where(o => o.Ativa && (periodicas.Contains(o.Id) || db.ObraEmpresas.Any(oe => oe.ObraId == o.Id && oe.Ativo
            && db.Empresas.Any(e => e.Id == oe.EmpresaId && e.Ativa)
            && db.ObraTiposDocumento.Any(m => m.ObraId == o.Id
                && db.TiposDocumento.Any(t => t.Id == m.TipoDocumentoId && t.Ativo && t.PeriodicidadeUnidade == UnidadePeriodicidade.UNICA)
                && !db.Envios.Any(v => v.EmpresaId == oe.EmpresaId && v.TipoDocumentoId == m.TipoDocumentoId && v.ObraId == o.Id
                    && v.Status != StatusEnvio.REJEITADO)))));
    }

    public static IQueryable<Obra> SemPendencia(IQueryable<Obra> q, DocsDbContext db, IReadOnlyCollection<Guid> comPendenciaPeriodica)
    {
        var com = ComPendencia(db.Obras, db, comPendenciaPeriodica).Select(o => o.Id);
        return q.Where(o => !com.Contains(o.Id));
    }
}

public sealed class ConsultaDocumentosEf(DocsDbContext db, CalculoPeriodicos periodicos) : IConsultaDocumentos
{
    private const int Aprovado = 3, EmAnalise = 2, Rejeitado = 1;

    /// <summary>
    /// Contagem pelo total de tipos exigidos: cada documento (único: situação pelos envios; periódico: situação resumida) conta
    /// uma vez; os sem situação definida são pendentes. <paramref name="periodosAtrasados"/> = soma dos períodos atrasados.
    /// </summary>
    private static ContagemDocumentosDto Contagem(int total, IReadOnlyCollection<int> prioridades, int periodosAtrasados = 0)
    {
        var aprovados = prioridades.Count(x => x == Aprovado);
        var emAnalise = prioridades.Count(x => x == EmAnalise);
        var rejeitados = prioridades.Count(x => x == Rejeitado);
        return new ContagemDocumentosDto(total, total - aprovados - emAnalise - rejeitados, emAnalise, aprovados, rejeitados, periodosAtrasados);
    }

    private static int Prioridade(SituacaoDocumento s) => s switch
    {
        SituacaoDocumento.APROVADO => Aprovado,
        SituacaoDocumento.EM_ANALISE => EmAnalise,
        SituacaoDocumento.REJEITADO => Rejeitado,
        _ => 0,
    };

    public async Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarPorEmpresaAsync(IReadOnlyCollection<Guid> empresaIds, CancellationToken ct = default)
    {
        var resultado = new Dictionary<Guid, ContagemDocumentosDto>();
        if (empresaIds.Count == 0) return resultado;

        var totalAtivos = await db.TiposDocumento.CountAsync(t => t.Ativo && t.Abrangencia == Abrangencia.GERAL, ct);
        var ids = empresaIds.Distinct().ToList();

        // Uma linha por (empresa, tipo GERAL ativo) com envios gerais: prioridade do envio que define a situação.
        var linhas = await (from e in db.Envios.AsNoTracking()
                            join t in db.TiposDocumento.AsNoTracking() on e.TipoDocumentoId equals t.Id
                            where t.Ativo && t.Abrangencia == Abrangencia.GERAL && t.PeriodicidadeUnidade == UnidadePeriodicidade.UNICA
                                  && e.ObraId == null && ids.Contains(e.EmpresaId)
                            group e by new { e.EmpresaId, e.TipoDocumentoId } into g
                            select new
                            {
                                g.Key.EmpresaId,
                                Prioridade = g.Max(x => x.Status == StatusEnvio.APROVADO ? Aprovado : x.Status == StatusEnvio.EM_ANALISE ? EmAnalise : Rejeitado),
                            }).ToListAsync(ct);

        var porEmpresa = linhas.ToLookup(l => l.EmpresaId, l => l.Prioridade);
        var periodicosPorEmpresa = (await periodicos.GeraisAsync(ids, ct)).ToLookup(d => d.EmpresaId);
        foreach (var id in ids)
        {
            var docs = periodicosPorEmpresa[id].ToList();
            resultado[id] = Contagem(totalAtivos, porEmpresa[id].Concat(docs.Select(d => Prioridade(d.Resumo.Situacao))).ToList(),
                docs.Sum(d => d.Resumo.Atrasados));
        }
        return resultado;
    }

    public async Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarPorObraAsync(Guid obraId, IReadOnlyCollection<Guid> empresaIds,
        CancellationToken ct = default)
    {
        var pares = await ContarParesAsync([obraId], empresaIds, ct);
        return pares.ToDictionary(kv => kv.Key.EmpresaId, kv => kv.Value);
    }

    public async Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarObrasDaEmpresaAsync(Guid empresaId, IReadOnlyCollection<Guid> obraIds,
        CancellationToken ct = default)
    {
        var pares = await ContarParesAsync(obraIds, [empresaId], ct);
        return pares.ToDictionary(kv => kv.Key.ObraId, kv => kv.Value);
    }

    /// <summary>Contagem dos documentos da obra para cada par obra × empresa (total = tipos marcados e ativos na obra).</summary>
    private async Task<Dictionary<(Guid ObraId, Guid EmpresaId), ContagemDocumentosDto>> ContarParesAsync(IReadOnlyCollection<Guid> obraIds,
        IReadOnlyCollection<Guid> empresaIds, CancellationToken ct)
    {
        var resultado = new Dictionary<(Guid, Guid), ContagemDocumentosDto>();
        if (obraIds.Count == 0 || empresaIds.Count == 0) return resultado;
        var obras = obraIds.Distinct().ToList();
        var empresas = empresaIds.Distinct().ToList();

        var totais = await (from m in db.ObraTiposDocumento.AsNoTracking()
                            join t in db.TiposDocumento.AsNoTracking() on m.TipoDocumentoId equals t.Id
                            where t.Ativo && obras.Contains(m.ObraId)
                            group m by m.ObraId into g
                            select new { ObraId = g.Key, Total = g.Count() }).ToDictionaryAsync(x => x.ObraId, x => x.Total, ct);

        var linhas = await (from e in db.Envios.AsNoTracking()
                            join m in db.ObraTiposDocumento.AsNoTracking()
                                on new { ObraId = e.ObraId, e.TipoDocumentoId } equals new { ObraId = (Guid?)m.ObraId, m.TipoDocumentoId }
                            join t in db.TiposDocumento.AsNoTracking() on e.TipoDocumentoId equals t.Id
                            where t.Ativo && t.PeriodicidadeUnidade == UnidadePeriodicidade.UNICA && obras.Contains(m.ObraId) && empresas.Contains(e.EmpresaId)
                            group e by new { m.ObraId, e.EmpresaId, e.TipoDocumentoId } into g
                            select new
                            {
                                g.Key.ObraId,
                                g.Key.EmpresaId,
                                Prioridade = g.Max(x => x.Status == StatusEnvio.APROVADO ? Aprovado : x.Status == StatusEnvio.EM_ANALISE ? EmAnalise : Rejeitado),
                            }).ToListAsync(ct);

        var porPar = linhas.ToLookup(l => (l.ObraId, l.EmpresaId), l => l.Prioridade);
        var periodicosPorPar = (await periodicos.DasObrasAsync(obras, empresas, somenteAtivos: false, ct)).ToLookup(d => (d.ObraId!.Value, d.EmpresaId));
        foreach (var o in obras)
        {
            foreach (var e in empresas)
            {
                var docs = periodicosPorPar[(o, e)].ToList();
                resultado[(o, e)] = Contagem(totais.GetValueOrDefault(o), porPar[(o, e)].Concat(docs.Select(d => Prioridade(d.Resumo.Situacao))).ToList(),
                    docs.Sum(d => d.Resumo.Atrasados));
            }
        }
        return resultado;
    }

    public async Task<PainelDto> ObterPainelAsync(DateTimeOffset agora, CancellationToken ct = default)
    {
        var enviosEmAnalise = await db.Envios.CountAsync(e => e.Status == StatusEnvio.EM_ANALISE, ct);
        var situacao = await periodicos.SituacaoGeralAsync(ct);
        var comPendencia = await ConsultasEmpresa.ComPendencia(db.Empresas.AsNoTracking(), db, situacao.EmpresasComPendencia).CountAsync(ct);
        var convidadas = await ConsultasEmpresa.ComSituacao(db.Empresas.AsNoTracking(), SituacaoAcesso.CONVIDADA, agora).CountAsync(ct)
                         + await ConsultasEmpresa.ComSituacao(db.Empresas.AsNoTracking(), SituacaoAcesso.CONVITE_EXPIRADO, agora).CountAsync(ct);
        var empresasAtivas = await db.Empresas.CountAsync(e => e.Ativa, ct);
        var obrasAtivas = await db.Obras.CountAsync(o => o.Ativa, ct);
        var obrasComPendencia = await ConsultasObra.ComPendencia(db.Obras.AsNoTracking(), db, situacao.ObrasComPendencia).CountAsync(ct);
        return new PainelDto(enviosEmAnalise, comPendencia, convidadas, empresasAtivas, obrasAtivas, obrasComPendencia, situacao.EmpresasComAtraso.Count);
    }
}
