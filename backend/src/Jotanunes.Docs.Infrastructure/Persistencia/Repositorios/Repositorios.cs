using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Jotanunes.Docs.Infrastructure.Persistencia.Consultas;
using Microsoft.EntityFrameworkCore;

namespace Jotanunes.Docs.Infrastructure.Persistencia.Repositorios;

internal static class Busca
{
    /// <summary>Padrão ILIKE "contém" com %, _ e \ escapados.</summary>
    public static string Contem(string termo) =>
        "%" + termo.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}

public sealed class ObraRepositorio(DocsDbContext db, CalculoPeriodicos periodicos) : IObraRepositorio
{
    public Task<Obra?> ObterAsync(Guid id, CancellationToken ct = default) => db.Obras.FirstOrDefaultAsync(o => o.Id == id, ct);

    public void Adicionar(Obra obra) => db.Obras.Add(obra);

    public async Task<PaginaResultado<ObraResumoDto>> ListarAsync(FiltroObras f, Paginacao p, CancellationToken ct = default)
    {
        var q = db.Obras.AsNoTracking();
        if (f.Busca is not null)
        {
            var padrao = Busca.Contem(f.Busca);
            q = q.Where(o => EF.Functions.ILike(EF.Functions.Unaccent(o.Nome), EF.Functions.Unaccent(padrao))
                          || (o.Codigo != null && EF.Functions.ILike(EF.Functions.Unaccent(o.Codigo), EF.Functions.Unaccent(padrao)))
                          || EF.Functions.ILike(EF.Functions.Unaccent(o.Cidade), EF.Functions.Unaccent(padrao)));
        }
        if (f.Ativa is { } a) q = q.Where(o => o.Ativa == a);
        if (f.ComPendencia is { } pend)
        {
            var periodicas = (await periodicos.SituacaoGeralAsync(ct)).ObrasComPendencia;
            q = pend ? ConsultasObra.ComPendencia(q, db, periodicas) : ConsultasObra.SemPendencia(q, db, periodicas);
        }

        var total = await q.CountAsync(ct);
        var itens = await q.OrderBy(o => EF.Functions.Unaccent(o.Nome.ToLower())).ThenBy(o => o.Id).Skip(p.Pular).Take(p.TamanhoPagina)
            .Select(o => new ObraResumoDto(o.Id, o.Nome, o.Codigo, o.Cidade, o.Uf, o.Ativa, o.CriadoEm,
                db.ObraEmpresas.Count(v => v.ObraId == o.Id && v.Ativo),
                db.ObraTiposDocumento.Count(m => m.ObraId == o.Id && db.TiposDocumento.Any(t => t.Id == m.TipoDocumentoId && t.Ativo))))
            .ToListAsync(ct);
        return new PaginaResultado<ObraResumoDto>(itens, total, p.Pagina, p.TamanhoPagina);
    }

    public Task<ObraEmpresa?> ObterVinculoAsync(Guid obraId, Guid empresaId, CancellationToken ct = default) =>
        db.ObraEmpresas.FirstOrDefaultAsync(v => v.ObraId == obraId && v.EmpresaId == empresaId, ct);

    public async Task VincularAsync(ObraEmpresa vinculo, CancellationToken ct = default)
    {
        if (await db.ObraEmpresas.AnyAsync(v => v.ObraId == vinculo.ObraId && v.EmpresaId == vinculo.EmpresaId, ct)) return;
        db.ObraEmpresas.Add(vinculo);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ErroUnicidade.EhViolacao(ex))
        {
            db.Entry(vinculo).State = EntityState.Detached; // criado por outra requisição ao mesmo tempo: idempotente
        }
    }

    public async Task<IReadOnlyList<(Empresa Empresa, DateTimeOffset VinculadoEm)>> ListarEmpresasDaObraAsync(Guid obraId, CancellationToken ct = default)
    {
        var linhas = await (from v in db.ObraEmpresas.AsNoTracking()
                            join e in db.Empresas.AsNoTracking() on v.EmpresaId equals e.Id
                            where v.ObraId == obraId && v.Ativo
                            orderby EF.Functions.Unaccent(e.RazaoSocial.ToLower()), e.Id
                            select new { e, v.VinculadoEm }).ToListAsync(ct);
        return linhas.Select(l => (l.e, l.VinculadoEm)).ToList();
    }

    public async Task<IReadOnlyList<VinculoEncerradoLinha>> ListarVinculosEncerradosAsync(Guid obraId, CancellationToken ct = default)
    {
        var linhas = await (from v in db.ObraEmpresas.AsNoTracking()
                            join e in db.Empresas.AsNoTracking() on v.EmpresaId equals e.Id
                            where v.ObraId == obraId && !v.Ativo
                            orderby v.EncerradoEm descending, e.Id
                            select new { e, v, Envios = db.Envios.Count(x => x.ObraId == obraId && x.EmpresaId == e.Id) }).ToListAsync(ct);
        return linhas.Select(l => new VinculoEncerradoLinha(l.e, l.v, l.Envios)).ToList();
    }

    public async Task<IReadOnlyList<Obra>> ListarObrasDaEmpresaAsync(Guid empresaId, CancellationToken ct = default) =>
        await (from v in db.ObraEmpresas.AsNoTracking()
               join o in db.Obras.AsNoTracking() on v.ObraId equals o.Id
               where v.EmpresaId == empresaId && v.Ativo
               orderby EF.Functions.Unaccent(o.Nome.ToLower()), o.Id
               select o).ToListAsync(ct);

    public async Task<IReadOnlyList<ObraDaEmpresaLinha>> ListarVinculosDaEmpresaAsync(Guid empresaId, CancellationToken ct = default)
    {
        var linhas = await (from v in db.ObraEmpresas.AsNoTracking()
                            join o in db.Obras.AsNoTracking() on v.ObraId equals o.Id
                            where v.EmpresaId == empresaId
                            orderby EF.Functions.Unaccent(o.Nome.ToLower()), o.Id
                            select new { o, v.Ativo }).ToListAsync(ct);
        return linhas.Select(l => new ObraDaEmpresaLinha(l.o, l.Ativo)).ToList();
    }

    public async Task<IReadOnlyList<ObraTipoDocumento>> ListarTiposMarcadosAsync(Guid obraId, CancellationToken ct = default) =>
        await db.ObraTiposDocumento.AsNoTracking().Where(m => m.ObraId == obraId).ToListAsync(ct);

    public Task<ObraTipoDocumento?> ObterMarcacaoAsync(Guid obraId, Guid tipoDocumentoId, CancellationToken ct = default) =>
        db.ObraTiposDocumento.FirstOrDefaultAsync(m => m.ObraId == obraId && m.TipoDocumentoId == tipoDocumentoId, ct);

    public async Task<bool> MarcarTipoAsync(ObraTipoDocumento marcacao, CancellationToken ct = default)
    {
        db.ObraTiposDocumento.Add(marcacao);
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException ex) when (ErroUnicidade.EhViolacao(ex))
        {
            // Marcada por outra requisição ao mesmo tempo: idempotente. Descarta o que ficou pendente nesta gravação
            // (a marcação e a linha de auditoria que iria junto).
            foreach (var entrada in db.ChangeTracker.Entries().Where(x => x.State == EntityState.Added).ToList())
            {
                entrada.State = EntityState.Detached;
            }
            return false;
        }
    }

    public void DesmarcarTipo(ObraTipoDocumento marcacao) => db.ObraTiposDocumento.Remove(marcacao);

    public async Task RemoverMarcacoesDoTipoAsync(Guid tipoDocumentoId, CancellationToken ct = default) =>
        db.ObraTiposDocumento.RemoveRange(await db.ObraTiposDocumento.Where(m => m.TipoDocumentoId == tipoDocumentoId).ToListAsync(ct));

    public Task<int> ContarTiposExigidosAsync(Guid obraId, CancellationToken ct = default) =>
        db.ObraTiposDocumento.CountAsync(m => m.ObraId == obraId && db.TiposDocumento.Any(t => t.Id == m.TipoDocumentoId && t.Ativo), ct);
}

public sealed class EmpresaRepositorio(DocsDbContext db, CalculoPeriodicos periodicos) : IEmpresaRepositorio
{
    public Task<Empresa?> ObterAsync(Guid id, CancellationToken ct = default) => db.Empresas.FirstOrDefaultAsync(e => e.Id == id, ct);

    public Task<Empresa?> ObterPorCnpjAsync(string cnpjNormalizado, CancellationToken ct = default) =>
        db.Empresas.FirstOrDefaultAsync(e => e.Cnpj == cnpjNormalizado, ct);

    public void Adicionar(Empresa empresa) => db.Empresas.Add(empresa);

    public async Task<PaginaResultado<Empresa>> ListarAsync(FiltroEmpresas f, Paginacao p, CancellationToken ct = default)
    {
        var q = db.Empresas.AsNoTracking();
        if (f.Busca is not null)
        {
            var padrao = Busca.Contem(f.Busca);
            var cnpj = Cnpj.Normalizar(f.Busca);
            var buscaCnpj = cnpj.Length > 0 && cnpj.All(c => char.IsAsciiDigit(c) || c is >= 'A' and <= 'Z');
            var padraoCnpj = Busca.Contem(cnpj);
            q = q.Where(e => EF.Functions.ILike(EF.Functions.Unaccent(e.RazaoSocial), EF.Functions.Unaccent(padrao))
                          || (e.NomeFantasia != null && EF.Functions.ILike(EF.Functions.Unaccent(e.NomeFantasia), EF.Functions.Unaccent(padrao)))
                          || (buscaCnpj && EF.Functions.Like(e.Cnpj, padraoCnpj)));
        }
        if (f.ObraId is { } obraId) q = q.Where(e => db.ObraEmpresas.Any(v => v.ObraId == obraId && v.EmpresaId == e.Id && v.Ativo));
        if (f.SituacaoAcesso is { } s) q = ConsultasEmpresa.ComSituacao(q, s, f.Agora);
        if (f.ComPendencia is not null || f.ComAtraso)
        {
            var situacao = await periodicos.SituacaoGeralAsync(ct);
            if (f.ComPendencia is { } pend)
            {
                q = pend
                    ? ConsultasEmpresa.ComPendencia(q, db, situacao.EmpresasComPendencia)
                    : ConsultasEmpresa.SemPendencia(q, db, situacao.EmpresasComPendencia);
            }
            if (f.ComAtraso)
            {
                var atrasadas = situacao.EmpresasComAtraso.ToList();
                q = q.Where(e => atrasadas.Contains(e.Id));
            }
        }

        var total = await q.CountAsync(ct);
        var itens = await q.OrderBy(e => EF.Functions.Unaccent(e.RazaoSocial.ToLower())).ThenBy(e => e.Id).Skip(p.Pular).Take(p.TamanhoPagina).ToListAsync(ct);
        return new PaginaResultado<Empresa>(itens, total, p.Pagina, p.TamanhoPagina);
    }
}

public sealed class TipoDocumentoRepositorio(DocsDbContext db) : ITipoDocumentoRepositorio
{
    public Task<TipoDocumento?> ObterAsync(Guid id, CancellationToken ct = default) => db.TiposDocumento.FirstOrDefaultAsync(t => t.Id == id, ct);

    public void Adicionar(TipoDocumento tipo) => db.TiposDocumento.Add(tipo);

    public async Task<IReadOnlyList<TipoDocumento>> ListarAsync(bool? ativo, Abrangencia? abrangencia = null, bool? periodico = null,
        CancellationToken ct = default)
    {
        var q = db.TiposDocumento.AsNoTracking();
        if (ativo is { } a) q = q.Where(t => t.Ativo == a);
        if (abrangencia is { } ab) q = q.Where(t => t.Abrangencia == ab);
        if (periodico is { } p) q = p ? q.Where(t => t.PeriodicidadeUnidade != UnidadePeriodicidade.UNICA) : q.Where(t => t.PeriodicidadeUnidade == UnidadePeriodicidade.UNICA);
        return await q.OrderBy(t => EF.Functions.Unaccent(t.Nome.ToLower())).ThenBy(t => t.Id).ToListAsync(ct);
    }

    public Task<bool> ExisteAlgumAsync(CancellationToken ct = default) => db.TiposDocumento.AnyAsync(ct);

    public Task<bool> TemEnviosAsync(Guid tipoDocumentoId, CancellationToken ct = default) =>
        db.Envios.AnyAsync(e => e.TipoDocumentoId == tipoDocumentoId, ct);
}

public sealed class ConviteRepositorio(DocsDbContext db) : IConviteRepositorio
{
    public void Adicionar(Convite convite) => db.Convites.Add(convite);

    public async Task<IReadOnlyList<Convite>> ListarDaEmpresaAsync(Guid empresaId, CancellationToken ct = default) =>
        await db.Convites.AsNoTracking().Where(c => c.EmpresaId == empresaId).OrderByDescending(c => c.EnviadoEm).ThenByDescending(c => c.Id).ToListAsync(ct);

    public Task<Convite?> ObterUltimoAsync(Guid empresaId, CancellationToken ct = default) =>
        db.Convites.AsNoTracking().Where(c => c.EmpresaId == empresaId).OrderByDescending(c => c.EnviadoEm).FirstOrDefaultAsync(ct);

    public Task<Convite?> ObterPorTokenHashAsync(string tokenHash, CancellationToken ct = default) =>
        db.Convites.AsNoTracking().FirstOrDefaultAsync(c => c.TokenHash == tokenHash, ct);

    public async Task<IReadOnlyList<Convite>> ListarAbertosAsync(Guid empresaId, CancellationToken ct = default) =>
        await db.Convites.Where(c => c.EmpresaId == empresaId && c.UsadoEm == null && c.SubstituidoEm == null).ToListAsync(ct);
}

public sealed class EnvioRepositorio(DocsDbContext db) : IEnvioRepositorio
{
    public void Adicionar(EnvioDocumento envio) => db.Envios.Add(envio);

    public Task<EnvioDocumento?> ObterAsync(Guid id, CancellationToken ct = default) =>
        db.Envios.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id, ct);

    /// <summary>Envios do contexto: obra nula = gerais (<c>obra_id IS NULL</c>); senão, os da obra.</summary>
    private IQueryable<EnvioDocumento> DoContexto(Guid empresaId, Guid? obraId)
    {
        var q = db.Envios.AsNoTracking().Where(e => e.EmpresaId == empresaId);
        return obraId is { } o ? q.Where(e => e.ObraId == o) : q.Where(e => e.ObraId == null);
    }

    public async Task<IReadOnlyList<EnvioDocumento>> ListarDaEmpresaAsync(Guid empresaId, Guid? obraId, CancellationToken ct = default) =>
        await DoContexto(empresaId, obraId).ToListAsync(ct);

    public async Task<IReadOnlyList<EnvioDocumento>> ListarHistoricoAsync(Guid empresaId, Guid tipoDocumentoId, Guid? obraId, DateOnly? periodoInicio = null,
        CancellationToken ct = default)
    {
        var q = DoContexto(empresaId, obraId).Where(e => e.TipoDocumentoId == tipoDocumentoId);
        if (periodoInicio is { } p) q = q.Where(e => e.PeriodoInicio == p);
        return await q.OrderByDescending(e => e.EnviadoEm).ThenByDescending(e => e.Id).ToListAsync(ct);
    }

    public Task<bool> ExisteVivoAsync(Guid empresaId, Guid tipoDocumentoId, Guid? obraId, DateOnly? periodoInicio = null, CancellationToken ct = default) =>
        DoContexto(empresaId, obraId).AnyAsync(e => e.TipoDocumentoId == tipoDocumentoId && e.PeriodoInicio == periodoInicio
                                                    && e.Status != StatusEnvio.REJEITADO, ct);

    public async Task<IReadOnlyDictionary<Guid, int>> ContarNaObraAsync(Guid obraId, IReadOnlyCollection<Guid> empresaIds, CancellationToken ct = default)
    {
        if (empresaIds.Count == 0) return new Dictionary<Guid, int>();
        var ids = empresaIds.Distinct().ToList();
        return await db.Envios.AsNoTracking()
            .Where(e => e.ObraId == obraId && ids.Contains(e.EmpresaId))
            .GroupBy(e => e.EmpresaId)
            .Select(g => new { g.Key, Quantidade = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Quantidade, ct);
    }

    public async Task<bool> RegistrarDecisaoAsync(EnvioDocumento d, CancellationToken ct = default)
    {
        var linhas = await db.Envios
            .Where(e => e.Id == d.Id && e.Status == StatusEnvio.EM_ANALISE)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.Status, d.Status)
                .SetProperty(e => e.AnalisadoEm, d.AnalisadoEm)
                .SetProperty(e => e.AnalisadoPorLogin, d.AnalisadoPorLogin)
                .SetProperty(e => e.AnalisadoPorNome, d.AnalisadoPorNome)
                .SetProperty(e => e.MotivoRejeicao, d.MotivoRejeicao), ct);
        return linhas == 1;
    }

    public async Task<PaginaResultado<EnvioFilaDto>> ListarFilaAsync(FiltroEnvios f, Paginacao p, CancellationToken ct = default)
    {
        var q = from e in db.Envios.AsNoTracking()
                join emp in db.Empresas.AsNoTracking() on e.EmpresaId equals emp.Id
                join t in db.TiposDocumento.AsNoTracking() on e.TipoDocumentoId equals t.Id
                join o in db.Obras.AsNoTracking() on e.ObraId equals (Guid?)o.Id into obras
                from o in obras.DefaultIfEmpty()
                where e.Status == f.Status
                select new { e, emp, t, o };
        if (f.EmpresaId is { } empresaId) q = q.Where(x => x.e.EmpresaId == empresaId);
        if (f.TipoDocumentoId is { } tipoId) q = q.Where(x => x.e.TipoDocumentoId == tipoId);
        if (f.ObraId is { } obraId) q = q.Where(x => x.e.ObraId == obraId);
        if (f.SomenteGerais) q = q.Where(x => x.e.ObraId == null);
        if (f.ComAtraso) q = q.Where(x => x.e.EnviadoComAtraso);

        var total = await q.CountAsync(ct);
        var ordenado = f.Status == StatusEnvio.EM_ANALISE
            ? q.OrderBy(x => x.e.EnviadoEm).ThenBy(x => x.e.Id)
            : q.OrderByDescending(x => x.e.EnviadoEm).ThenByDescending(x => x.e.Id);
        var linhas = await ordenado.Skip(p.Pular).Take(p.TamanhoPagina).ToListAsync(ct);
        return new PaginaResultado<EnvioFilaDto>(linhas.Select(l => EnvioFilaDto.De(l.e, l.emp, l.t, l.o)).ToList(), total, p.Pagina, p.TamanhoPagina);
    }

    public async Task<EnvioFilaDto?> ObterFilaAsync(Guid id, CancellationToken ct = default)
    {
        var l = await (from e in db.Envios.AsNoTracking()
                       join emp in db.Empresas.AsNoTracking() on e.EmpresaId equals emp.Id
                       join t in db.TiposDocumento.AsNoTracking() on e.TipoDocumentoId equals t.Id
                       join o in db.Obras.AsNoTracking() on e.ObraId equals (Guid?)o.Id into obras
                       from o in obras.DefaultIfEmpty()
                       where e.Id == id
                       select new { e, emp, t, o }).FirstOrDefaultAsync(ct);
        return l is null ? null : EnvioFilaDto.De(l.e, l.emp, l.t, l.o);
    }
}
