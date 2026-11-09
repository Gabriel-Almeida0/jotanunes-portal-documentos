using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Infrastructure.Persistencia.Consultas;

/// <summary>Documento periódico (empresa × tipo, geral ou da obra) com a situação resumida dos períodos.</summary>
public sealed record DocumentoPeriodico(Guid EmpresaId, Guid? ObraId, Guid TipoDocumentoId, ResumoPeriodico Resumo);

/// <summary>Conjuntos usados nos filtros "com pendência"/"com atraso" e no painel (só documentos periódicos).</summary>
public sealed record SituacaoPeriodicaGeral(HashSet<Guid> EmpresasComPendencia, HashSet<Guid> EmpresasComAtraso, HashSet<Guid> ObrasComPendencia);

/// <summary>
/// Situação dos documentos periódicos em lote (003 research R8): poucas consultas agregadas (tipos periódicos, marcos de
/// início da cobrança e a melhor situação dos envios por período) e o cálculo dos períodos em memória com as regras do
/// domínio (<see cref="CalendarioPeriodos"/>, <see cref="RegraPeriodos"/>). Sem tipo periódico ativo, nenhuma consulta além da
/// dos tipos.
/// </summary>
public sealed class CalculoPeriodicos(DocsDbContext db, TimeProvider relogio)
{
    private const int Aprovado = 3, EmAnalise = 2, Rejeitado = 1;

    private SituacaoPeriodicaGeral? _geral;

    private DateOnly Hoje => DataLocal.De(relogio.GetUtcNow());

    private static SituacaoDocumento Situacao(int prioridade) => prioridade switch
    {
        Aprovado => SituacaoDocumento.APROVADO,
        EmAnalise => SituacaoDocumento.EM_ANALISE,
        Rejeitado => SituacaoDocumento.REJEITADO,
        _ => SituacaoDocumento.PENDENTE_ENVIO,
    };

    private Task<List<TipoDocumento>> TiposPeriodicosAsync(Abrangencia abrangencia, CancellationToken ct) =>
        db.TiposDocumento.AsNoTracking()
            .Where(t => t.Ativo && t.Abrangencia == abrangencia && t.PeriodicidadeUnidade != UnidadePeriodicidade.UNICA)
            .ToListAsync(ct);

    private static ResumoPeriodico Resumir(TipoDocumento tipo, DateOnly inicio, DateOnly ate, IReadOnlyDictionary<DateOnly, int> prioridades, DateOnly hoje) =>
        RegraPeriodos.Resumir(RegraPeriodos.Avaliar(RegraPeriodos.Exigidos(tipo, inicio, ate),
            d => Situacao(prioridades.GetValueOrDefault(d)), hoje));

    /// <summary>
    /// Documentos GERAIS periódicos (tipos ativos) das empresas informadas; <paramref name="empresaIds"/> null = todas as
    /// empresas ativas.
    /// </summary>
    public async Task<List<DocumentoPeriodico>> GeraisAsync(IReadOnlyCollection<Guid>? empresaIds, CancellationToken ct = default)
    {
        var resultado = new List<DocumentoPeriodico>();
        var tipos = await TiposPeriodicosAsync(Abrangencia.GERAL, ct);
        if (tipos.Count == 0 || empresaIds is { Count: 0 }) return resultado;
        var tipoIds = tipos.Select(t => t.Id).ToList();
        var ids = empresaIds?.Distinct().ToList();

        var empresasQ = db.Empresas.AsNoTracking();
        empresasQ = ids is null ? empresasQ.Where(e => e.Ativa) : empresasQ.Where(e => ids.Contains(e.Id));
        var empresas = await empresasQ.Select(e => new { e.Id, e.CriadoEm }).ToListAsync(ct);

        var envios = db.Envios.AsNoTracking()
            .Where(e => e.ObraId == null && e.PeriodoInicio != null && tipoIds.Contains(e.TipoDocumentoId));
        if (ids is not null) envios = envios.Where(e => ids.Contains(e.EmpresaId));
        var linhas = await envios
            .GroupBy(e => new { e.EmpresaId, e.TipoDocumentoId, e.PeriodoInicio })
            .Select(g => new
            {
                g.Key.EmpresaId,
                g.Key.TipoDocumentoId,
                g.Key.PeriodoInicio,
                Prioridade = g.Max(x => x.Status == StatusEnvio.APROVADO ? Aprovado : x.Status == StatusEnvio.EM_ANALISE ? EmAnalise : Rejeitado),
            })
            .ToListAsync(ct);
        var porDocumento = linhas
            .GroupBy(l => (l.EmpresaId, l.TipoDocumentoId))
            .ToDictionary(g => g.Key, g => g.ToDictionary(l => l.PeriodoInicio!.Value, l => l.Prioridade));

        var hoje = Hoje;
        var vazio = new Dictionary<DateOnly, int>();
        foreach (var e in empresas)
        {
            foreach (var t in tipos)
            {
                var inicio = RegraPeriodos.InicioCobranca(e.CriadoEm, t.CobrancaDesde);
                resultado.Add(new DocumentoPeriodico(e.Id, null, t.Id,
                    Resumir(t, inicio, hoje, porDocumento.GetValueOrDefault((e.Id, t.Id), vazio), hoje)));
            }
        }
        return resultado;
    }

    /// <summary>
    /// Documentos periódicos das obras (tipos POR_OBRA ativos marcados) para cada vínculo obra × empresa. Filtros nulos =
    /// todos. Com <paramref name="somenteAtivos"/>: só vínculos ativos, em obras ativas, de empresas ativas (filtros de
    /// pendência e painel); senão inclui vínculos encerrados, com períodos até o encerramento (contagens).
    /// </summary>
    public async Task<List<DocumentoPeriodico>> DasObrasAsync(IReadOnlyCollection<Guid>? obraIds, IReadOnlyCollection<Guid>? empresaIds, bool somenteAtivos,
        CancellationToken ct = default)
    {
        var resultado = new List<DocumentoPeriodico>();
        if (obraIds is { Count: 0 } || empresaIds is { Count: 0 }) return resultado;
        var tipos = await TiposPeriodicosAsync(Abrangencia.POR_OBRA, ct);
        if (tipos.Count == 0) return resultado;
        var tiposPorId = tipos.ToDictionary(t => t.Id);
        var tipoIds = tiposPorId.Keys.ToList();
        var obras = obraIds?.Distinct().ToList();
        var empresas = empresaIds?.Distinct().ToList();

        var marcacoesQ = db.ObraTiposDocumento.AsNoTracking().Where(m => tipoIds.Contains(m.TipoDocumentoId));
        if (obras is not null) marcacoesQ = marcacoesQ.Where(m => obras.Contains(m.ObraId));
        var marcacoes = (await marcacoesQ.ToListAsync(ct)).ToLookup(m => m.ObraId);
        if (marcacoes.Count == 0) return resultado;
        var obrasMarcadas = marcacoes.Select(g => g.Key).ToList();

        var vinculosQ = db.ObraEmpresas.AsNoTracking().Where(v => obrasMarcadas.Contains(v.ObraId));
        if (empresas is not null) vinculosQ = vinculosQ.Where(v => empresas.Contains(v.EmpresaId));
        if (somenteAtivos)
        {
            vinculosQ = vinculosQ.Where(v => v.Ativo
                && db.Obras.Any(o => o.Id == v.ObraId && o.Ativa)
                && db.Empresas.Any(e => e.Id == v.EmpresaId && e.Ativa));
        }
        var vinculos = await vinculosQ.ToListAsync(ct);
        if (vinculos.Count == 0) return resultado;

        var enviosQ = db.Envios.AsNoTracking()
            .Where(e => e.ObraId != null && e.PeriodoInicio != null && tipoIds.Contains(e.TipoDocumentoId) && obrasMarcadas.Contains(e.ObraId.Value));
        if (empresas is not null) enviosQ = enviosQ.Where(e => empresas.Contains(e.EmpresaId));
        var linhas = await enviosQ
            .GroupBy(e => new { e.EmpresaId, e.ObraId, e.TipoDocumentoId, e.PeriodoInicio })
            .Select(g => new
            {
                g.Key.EmpresaId,
                g.Key.ObraId,
                g.Key.TipoDocumentoId,
                g.Key.PeriodoInicio,
                Prioridade = g.Max(x => x.Status == StatusEnvio.APROVADO ? Aprovado : x.Status == StatusEnvio.EM_ANALISE ? EmAnalise : Rejeitado),
            })
            .ToListAsync(ct);
        var porDocumento = linhas
            .GroupBy(l => (l.EmpresaId, ObraId: l.ObraId!.Value, l.TipoDocumentoId))
            .ToDictionary(g => g.Key, g => g.ToDictionary(l => l.PeriodoInicio!.Value, l => l.Prioridade));

        var hoje = Hoje;
        var vazio = new Dictionary<DateOnly, int>();
        foreach (var v in vinculos)
        {
            var ate = v is { Ativo: false, EncerradoEm: { } fim } ? DataLocal.De(fim) : hoje;
            foreach (var m in marcacoes[v.ObraId])
            {
                var t = tiposPorId[m.TipoDocumentoId];
                var inicio = RegraPeriodos.InicioCobranca(v.VinculadoEm, m.MarcadoEm, t.CobrancaDesde);
                resultado.Add(new DocumentoPeriodico(v.EmpresaId, v.ObraId, t.Id,
                    Resumir(t, inicio, ate, porDocumento.GetValueOrDefault((v.EmpresaId, v.ObraId, t.Id), vazio), hoje)));
            }
        }
        return resultado;
    }

    /// <summary>
    /// Empresas ativas com documento periódico pendente/rejeitado/atrasado (FR-321) ou com algum período atrasado (FR-322),
    /// e obras ativas com pendência periódica — gerais e das obras (vínculo ativo em obra ativa). Calculado uma vez por escopo.
    /// </summary>
    public async Task<SituacaoPeriodicaGeral> SituacaoGeralAsync(CancellationToken ct = default)
    {
        if (_geral is not null) return _geral;
        var docs = (await GeraisAsync(null, ct)).Concat(await DasObrasAsync(null, null, somenteAtivos: true, ct)).ToList();
        static bool PedeAcao(DocumentoPeriodico d) => d.Resumo.Situacao is SituacaoDocumento.PENDENTE_ENVIO or SituacaoDocumento.REJEITADO;
        _geral = new SituacaoPeriodicaGeral(
            docs.Where(PedeAcao).Select(d => d.EmpresaId).ToHashSet(),
            docs.Where(d => d.Resumo.Atrasado).Select(d => d.EmpresaId).ToHashSet(),
            docs.Where(d => d.ObraId is not null && PedeAcao(d)).Select(d => d.ObraId!.Value).ToHashSet());
        return _geral;
    }
}
