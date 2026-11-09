using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Application.Obras;

public sealed class CriarObra(IObraRepositorio obras, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<ObraDto> ExecutarAsync(ObraInput entrada, CancellationToken ct = default)
    {
        Obra obra;
        try { obra = Obra.Criar(entrada.Nome, entrada.Codigo, entrada.Cidade, entrada.Uf, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        obras.Adicionar(obra);
        await uow.SalvarAsync(ct);
        return ObraDto.De(obra);
    }
}

public sealed class AtualizarObra(IObraRepositorio obras, IUnidadeTrabalho uow, IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task<ObraDto> ExecutarAsync(Guid id, ObraInput entrada, CancellationToken ct = default)
    {
        var obra = await obras.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var ativa = Entrada.Obrigatorio(entrada.Ativa, "ativa");
        try { obra.Atualizar(entrada.Nome, entrada.Codigo, entrada.Cidade, entrada.Uf, ativa, usuario.Login, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }
        await uow.SalvarAsync(ct);
        return ObraDto.De(obra);
    }
}

public sealed class ListarObras(IObraRepositorio obras) : ICasoDeUso
{
    public Task<PaginaResultado<ObraResumoDto>> ExecutarAsync(string? busca, bool? ativa, bool? comPendencia, int? pagina, int? tamanhoPagina,
        CancellationToken ct = default) =>
        obras.ListarAsync(new FiltroObras(Entrada.Busca(busca), ativa, comPendencia), Paginacao.Criar(pagina, tamanhoPagina), ct);
}

/// <summary>Detalhe da obra: empresas com vínculo ativo (contagens da obra e gerais), vínculos encerrados e tipos exigidos.</summary>
public sealed class ObterObra(IObraRepositorio obras, IEnvioRepositorio envios, IConsultaDocumentos consulta, TimeProvider relogio) : ICasoDeUso
{
    public async Task<ObraDetalheDto> ExecutarAsync(Guid id, CancellationToken ct = default)
    {
        var obra = await obras.ObterAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var vinculadas = await obras.ListarEmpresasDaObraAsync(id, ct);
        var ids = vinculadas.Select(v => v.Empresa.Id).ToList();
        var gerais = await consulta.ContarPorEmpresaAsync(ids, ct);
        var daObra = await consulta.ContarPorObraAsync(id, ids, ct);
        var enviosNaObra = await envios.ContarNaObraAsync(id, ids, ct);
        var agora = relogio.GetUtcNow();
        var empresas = vinculadas
            .Select(v => new EmpresaNaObraDto(v.Empresa.Id, v.Empresa.RazaoSocial, v.Empresa.Cnpj, v.Empresa.ObterSituacaoAcesso(agora),
                v.VinculadoEm, daObra[v.Empresa.Id], gerais[v.Empresa.Id], enviosNaObra.GetValueOrDefault(v.Empresa.Id)))
            .ToList();
        var encerrados = (await obras.ListarVinculosEncerradosAsync(id, ct))
            .Select(l => new VinculoEncerradoDto(l.Empresa.Id, l.Empresa.RazaoSocial, l.Empresa.Cnpj, l.Vinculo.EncerradoEm!.Value,
                l.Vinculo.EncerradoPorLogin, l.QuantidadeEnvios))
            .ToList();
        return new ObraDetalheDto(obra.Id, obra.Nome, obra.Codigo, obra.Cidade, obra.Uf, obra.Ativa, obra.CriadoEm, empresas, encerrados,
            await obras.ContarTiposExigidosAsync(id, ct));
    }
}

/// <summary>Cria o vínculo, ou reabre o encerrado (auditoria VINCULO_REABERTO); já ativo → nada (research R5).</summary>
public sealed class VincularEmpresa(IObraRepositorio obras, IEmpresaRepositorio empresas, IUnidadeTrabalho uow, IRegistroAuditoria auditoria,
    IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task ExecutarAsync(Guid obraId, Guid empresaId, CancellationToken ct = default)
    {
        _ = await obras.ObterAsync(obraId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        _ = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var vinculo = await obras.ObterVinculoAsync(obraId, empresaId, ct);
        if (vinculo is null)
        {
            await obras.VincularAsync(new ObraEmpresa(obraId, empresaId, usuario.Login, relogio.GetUtcNow()), ct);
            return;
        }
        if (!vinculo.Reabrir(usuario.Login, relogio.GetUtcNow())) return;
        auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.VinculoReaberto, RecursoAuditoria.Vinculo,
            RecursoAuditoria.IdComposto(obraId, empresaId));
        await uow.SalvarAsync(ct);
    }
}

/// <summary>Encerra o vínculo (histórico preservado); já encerrado → nada; inexistente → 404 (research R5).</summary>
public sealed class DesvincularEmpresa(IObraRepositorio obras, IUnidadeTrabalho uow, IRegistroAuditoria auditoria, IUsuarioFluigAtual usuario,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task ExecutarAsync(Guid obraId, Guid empresaId, CancellationToken ct = default)
    {
        var vinculo = await obras.ObterVinculoAsync(obraId, empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        if (!vinculo.Encerrar(usuario.Login, relogio.GetUtcNow())) return;
        auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.VinculoEncerrado, RecursoAuditoria.Vinculo,
            RecursoAuditoria.IdComposto(obraId, empresaId));
        await uow.SalvarAsync(ct);
    }
}

/// <summary>Tipos POR_OBRA ativos e, dos inativos, só os marcados; ordenados por nome.</summary>
public sealed class ListarTiposExigidosObra(IObraRepositorio obras, ITipoDocumentoRepositorio tipos) : ICasoDeUso
{
    public async Task<IReadOnlyList<TipoExigidoObraDto>> ExecutarAsync(Guid obraId, CancellationToken ct = default)
    {
        _ = await obras.ObterAsync(obraId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var marcados = (await obras.ListarTiposMarcadosAsync(obraId, ct)).ToDictionary(m => m.TipoDocumentoId);
        return (await tipos.ListarAsync(null, Abrangencia.POR_OBRA, ct: ct))
            .Where(t => t.Ativo || marcados.ContainsKey(t.Id))
            .Select(t => new TipoExigidoObraDto(TipoDocumentoDto.De(t), marcados.ContainsKey(t.Id), marcados.GetValueOrDefault(t.Id)?.MarcadoEm))
            .ToList();
    }
}

internal static class AlvoMarcacao
{
    public static async Task<TipoDocumento> ResolverAsync(IObraRepositorio obras, ITipoDocumentoRepositorio tipos, Guid obraId, Guid tipoDocumentoId,
        CancellationToken ct)
    {
        _ = await obras.ObterAsync(obraId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        return await tipos.ObterAsync(tipoDocumentoId, ct) ?? throw ErroAplicacao.NaoEncontrado();
    }
}

/// <summary>Marca o tipo POR_OBRA como exigido na obra (idempotente; tipo GERAL → 400 TIPO_NAO_E_POR_OBRA).</summary>
public sealed class MarcarTipoExigidoObra(IObraRepositorio obras, ITipoDocumentoRepositorio tipos, IRegistroAuditoria auditoria,
    IUsuarioFluigAtual usuario, TimeProvider relogio) : ICasoDeUso
{
    public async Task ExecutarAsync(Guid obraId, Guid tipoDocumentoId, CancellationToken ct = default)
    {
        var tipo = await AlvoMarcacao.ResolverAsync(obras, tipos, obraId, tipoDocumentoId, ct);
        if (tipo.Abrangencia != Abrangencia.POR_OBRA) throw new ErroAplicacao(CodigoErro.TIPO_NAO_E_POR_OBRA);
        if (await obras.ObterMarcacaoAsync(obraId, tipoDocumentoId, ct) is not null) return;
        // A auditoria entra na mesma gravação da marcação; se outra requisição marcou antes, nenhuma das duas é gravada.
        auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.ObraTipoMarcado, RecursoAuditoria.Obra,
            RecursoAuditoria.IdComposto(obraId, tipoDocumentoId));
        await obras.MarcarTipoAsync(new ObraTipoDocumento(obraId, tipoDocumentoId, usuario.Login, relogio.GetUtcNow()), ct);
    }
}

/// <summary>Deixa de exigir o tipo na obra (idempotente; envios preservados).</summary>
public sealed class DesmarcarTipoExigidoObra(IObraRepositorio obras, ITipoDocumentoRepositorio tipos, IUnidadeTrabalho uow,
    IRegistroAuditoria auditoria, IUsuarioFluigAtual usuario) : ICasoDeUso
{
    public async Task ExecutarAsync(Guid obraId, Guid tipoDocumentoId, CancellationToken ct = default)
    {
        _ = await AlvoMarcacao.ResolverAsync(obras, tipos, obraId, tipoDocumentoId, ct);
        var marcacao = await obras.ObterMarcacaoAsync(obraId, tipoDocumentoId, ct);
        if (marcacao is null) return;
        obras.DesmarcarTipo(marcacao);
        auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.ObraTipoDesmarcado, RecursoAuditoria.Obra,
            RecursoAuditoria.IdComposto(obraId, tipoDocumentoId));
        await uow.SalvarAsync(ct);
    }
}
