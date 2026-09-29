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

public sealed class ObraRepositorio(DocsDbContext db) : IObraRepositorio
{
    public Task<Obra?> ObterAsync(Guid id, CancellationToken ct = default) => db.Obras.FirstOrDefaultAsync(o => o.Id == id, ct);

    public void Adicionar(Obra obra) => db.Obras.Add(obra);

    public async Task<PaginaResultado<ObraResumoDto>> ListarAsync(string? busca, bool? ativa, Paginacao p, CancellationToken ct = default)
    {
        var q = db.Obras.AsNoTracking();
        if (busca is not null)
        {
            var padrao = Busca.Contem(busca);
            q = q.Where(o => EF.Functions.ILike(EF.Functions.Unaccent(o.Nome), EF.Functions.Unaccent(padrao))
                          || (o.Codigo != null && EF.Functions.ILike(EF.Functions.Unaccent(o.Codigo), EF.Functions.Unaccent(padrao)))
                          || EF.Functions.ILike(EF.Functions.Unaccent(o.Cidade), EF.Functions.Unaccent(padrao)));
        }
        if (ativa is { } a) q = q.Where(o => o.Ativa == a);

        var total = await q.CountAsync(ct);
        var itens = await q.OrderBy(o => EF.Functions.Unaccent(o.Nome.ToLower())).ThenBy(o => o.Id).Skip(p.Pular).Take(p.TamanhoPagina)
            .Select(o => new ObraResumoDto(o.Id, o.Nome, o.Codigo, o.Cidade, o.Uf, o.Ativa, o.CriadoEm,
                db.ObraEmpresas.Count(v => v.ObraId == o.Id)))
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

    public void RemoverVinculo(ObraEmpresa vinculo) => db.ObraEmpresas.Remove(vinculo);

    public async Task<IReadOnlyList<(Empresa Empresa, DateTimeOffset VinculadoEm)>> ListarEmpresasDaObraAsync(Guid obraId, CancellationToken ct = default)
    {
        var linhas = await (from v in db.ObraEmpresas.AsNoTracking()
                            join e in db.Empresas.AsNoTracking() on v.EmpresaId equals e.Id
                            where v.ObraId == obraId
                            orderby EF.Functions.Unaccent(e.RazaoSocial.ToLower()), e.Id
                            select new { e, v.VinculadoEm }).ToListAsync(ct);
        return linhas.Select(l => (l.e, l.VinculadoEm)).ToList();
    }

    public async Task<IReadOnlyList<Obra>> ListarObrasDaEmpresaAsync(Guid empresaId, CancellationToken ct = default) =>
        await (from v in db.ObraEmpresas.AsNoTracking()
               join o in db.Obras.AsNoTracking() on v.ObraId equals o.Id
               where v.EmpresaId == empresaId
               orderby EF.Functions.Unaccent(o.Nome.ToLower()), o.Id
               select o).ToListAsync(ct);
}

public sealed class EmpresaRepositorio(DocsDbContext db) : IEmpresaRepositorio
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
        if (f.ObraId is { } obraId) q = q.Where(e => db.ObraEmpresas.Any(v => v.ObraId == obraId && v.EmpresaId == e.Id));
        if (f.SituacaoAcesso is { } s) q = ConsultasEmpresa.ComSituacao(q, s, f.Agora);
        if (f.ComPendencia is { } pend) q = pend ? ConsultasEmpresa.ComPendencia(q, db) : ConsultasEmpresa.SemPendencia(q, db);

        var total = await q.CountAsync(ct);
        var itens = await q.OrderBy(e => EF.Functions.Unaccent(e.RazaoSocial.ToLower())).ThenBy(e => e.Id).Skip(p.Pular).Take(p.TamanhoPagina).ToListAsync(ct);
        return new PaginaResultado<Empresa>(itens, total, p.Pagina, p.TamanhoPagina);
    }
}

public sealed class TipoDocumentoRepositorio(DocsDbContext db) : ITipoDocumentoRepositorio
{
    public Task<TipoDocumento?> ObterAsync(Guid id, CancellationToken ct = default) => db.TiposDocumento.FirstOrDefaultAsync(t => t.Id == id, ct);

    public void Adicionar(TipoDocumento tipo) => db.TiposDocumento.Add(tipo);

    public async Task<IReadOnlyList<TipoDocumento>> ListarAsync(bool? ativo, CancellationToken ct = default)
    {
        var q = db.TiposDocumento.AsNoTracking();
        if (ativo is { } a) q = q.Where(t => t.Ativo == a);
        return await q.OrderBy(t => EF.Functions.Unaccent(t.Nome.ToLower())).ThenBy(t => t.Id).ToListAsync(ct);
    }
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

    public async Task<IReadOnlyList<EnvioDocumento>> ListarDaEmpresaAsync(Guid empresaId, CancellationToken ct = default) =>
        await db.Envios.AsNoTracking().Where(e => e.EmpresaId == empresaId).ToListAsync(ct);

    public async Task<IReadOnlyList<EnvioDocumento>> ListarHistoricoAsync(Guid empresaId, Guid tipoDocumentoId, CancellationToken ct = default) =>
        await db.Envios.AsNoTracking()
            .Where(e => e.EmpresaId == empresaId && e.TipoDocumentoId == tipoDocumentoId)
            .OrderByDescending(e => e.EnviadoEm).ThenByDescending(e => e.Id)
            .ToListAsync(ct);

    public Task<bool> ExisteVivoAsync(Guid empresaId, Guid tipoDocumentoId, CancellationToken ct = default) =>
        db.Envios.AnyAsync(e => e.EmpresaId == empresaId && e.TipoDocumentoId == tipoDocumentoId && e.Status != StatusEnvio.REJEITADO, ct);

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
                where e.Status == f.Status
                select new { e, emp, t };
        if (f.EmpresaId is { } empresaId) q = q.Where(x => x.e.EmpresaId == empresaId);
        if (f.TipoDocumentoId is { } tipoId) q = q.Where(x => x.e.TipoDocumentoId == tipoId);
        if (f.ObraId is { } obraId) q = q.Where(x => db.ObraEmpresas.Any(v => v.ObraId == obraId && v.EmpresaId == x.e.EmpresaId));

        var total = await q.CountAsync(ct);
        var ordenado = f.Status == StatusEnvio.EM_ANALISE
            ? q.OrderBy(x => x.e.EnviadoEm).ThenBy(x => x.e.Id)
            : q.OrderByDescending(x => x.e.EnviadoEm).ThenByDescending(x => x.e.Id);
        var linhas = await ordenado.Skip(p.Pular).Take(p.TamanhoPagina).ToListAsync(ct);
        return new PaginaResultado<EnvioFilaDto>(linhas.Select(l => EnvioFilaDto.De(l.e, l.emp, l.t)).ToList(), total, p.Pagina, p.TamanhoPagina);
    }

    public async Task<EnvioFilaDto?> ObterFilaAsync(Guid id, CancellationToken ct = default)
    {
        var l = await (from e in db.Envios.AsNoTracking()
                       join emp in db.Empresas.AsNoTracking() on e.EmpresaId equals emp.Id
                       join t in db.TiposDocumento.AsNoTracking() on e.TipoDocumentoId equals t.Id
                       where e.Id == id
                       select new { e, emp, t }).FirstOrDefaultAsync(ct);
        return l is null ? null : EnvioFilaDto.De(l.e, l.emp, l.t);
    }
}
