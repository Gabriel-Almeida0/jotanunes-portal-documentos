using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Application.Envios;

/// <summary>
/// Alcance do portal nas rotas de obra (research R8): a obra só é resolvida entre as obras ATIVAS com vínculo ATIVO da
/// empresa do token; qualquer outro caso (outra empresa, vínculo encerrado, obra inativa, inexistente) → 404.
/// </summary>
public sealed class ObraDoPortal(IEmpresaPortalAtual atual, IObraRepositorio obras, ITipoDocumentoRepositorio tipos) : ICasoDeUso
{
    public async Task<bool> AlcancaAsync(Guid obraId, CancellationToken ct = default)
    {
        var obra = await obras.ObterAsync(obraId, ct);
        if (obra is null || !obra.Ativa) return false;
        var vinculo = await obras.ObterVinculoAsync(obraId, atual.EmpresaId, ct);
        return vinculo is { Ativo: true };
    }

    public async Task GarantirAsync(Guid obraId, CancellationToken ct = default)
    {
        if (!await AlcancaAsync(obraId, ct)) throw ErroAplicacao.NaoEncontrado();
    }

    /// <summary>Tipo POR_OBRA marcado na obra (já conferida); senão 404. Com <paramref name="exigirAtivo"/>, tipo inativo → 404.</summary>
    public async Task<(TipoDocumento Tipo, ObraTipoDocumento Marcacao)> TipoMarcadoAsync(Guid obraId, Guid tipoDocumentoId, bool exigirAtivo,
        CancellationToken ct = default)
    {
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || tipo.Abrangencia != Abrangencia.POR_OBRA || (exigirAtivo && !tipo.Ativo)) throw ErroAplicacao.NaoEncontrado();
        var marcacao = await obras.ObterMarcacaoAsync(obraId, tipoDocumentoId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        return (tipo, marcacao);
    }

    /// <summary>Vínculo ativo da empresa do token com a obra (já conferida por <see cref="GarantirAsync"/>).</summary>
    public async Task<ObraEmpresa> VinculoAsync(Guid obraId, CancellationToken ct = default) =>
        await obras.ObterVinculoAsync(obraId, atual.EmpresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
}

public static class NomeArquivo
{
    public static string Sanear(string? nome)
    {
        var n = (nome ?? string.Empty).Replace('\\', '/');
        n = n[(n.LastIndexOf('/') + 1)..];
        n = new string(n.Where(c => !char.IsControl(c) && c is not '"' and not '<' and not '>' and not '|' and not ':' and not '*' and not '?').ToArray()).Trim();
        if (n.Length == 0 || n is "." or "..") n = "arquivo";
        if (n.Length > 255)
        {
            var ext = Path.GetExtension(n);
            n = ext.Length is > 0 and <= 10 ? n[..(255 - ext.Length)] + ext : n[..255];
        }
        return n;
    }
}

internal static class SituacaoPortal
{
    private static readonly SituacaoDocumento[] Ordem =
        [SituacaoDocumento.REJEITADO, SituacaoDocumento.PENDENTE_ENVIO, SituacaoDocumento.EM_ANALISE, SituacaoDocumento.APROVADO];

    /// <summary>
    /// Ordem do portal: atrasado, rejeitado, pendente, em análise, aprovado; depois nome. Para tipo periódico, a situação é a
    /// resumida dos períodos (<paramref name="cobranca"/> dá a janela de cobrança de cada tipo).
    /// </summary>
    public static IReadOnlyList<DocumentoSituacaoPortalDto> Montar(IEnumerable<TipoDocumento> tipos, IEnumerable<EnvioDocumento> envios,
        Func<TipoDocumento, Cobranca> cobranca, DateOnly hoje)
    {
        var porTipo = envios.ToLookup(e => e.TipoDocumentoId);
        return tipos
            .Select(t =>
            {
                var a = Periodicos.Avaliar(t, porTipo[t.Id].ToList(), () => cobranca(t), hoje);
                return new DocumentoSituacaoPortalDto(TipoDocumentoRefDto.De(t), a.Situacao,
                    a.EnvioAtual is null ? null : EnvioPortalDto.De(a.EnvioAtual, t), RegraSituacaoDocumento.PodeEnviar(a.Situacao, true, t.Ativo),
                    a.Atrasado, a.Resumo is null ? null : ResumoPeriodosDto.De(a.Resumo));
            })
            .OrderBy(d => d.Atrasado ? -1 : Array.IndexOf(Ordem, d.Situacao))
            .ThenBy(d => Ordenacao.Chave(d.TipoDocumento.Nome), StringComparer.Ordinal)
            .ToList();
    }

    /// <summary>Períodos (mais recente primeiro) na visão da empresa.</summary>
    public static IReadOnlyList<PeriodoPortalDto> Periodos(TipoDocumento tipo, Cobranca cobranca, IEnumerable<EnvioDocumento> envios, DateOnly hoje) =>
        Periodicos.Detalhar(tipo, cobranca, envios, hoje)
            .OrderByDescending(p => p.Periodo.Inicio)
            .Select(p => new PeriodoPortalDto(p.Periodo.Inicio, p.Periodo.Fim, p.Periodo.Rotulo, p.Periodo.Prazo, p.Situacao, p.Atrasado,
                p.EnvioAtual is null ? null : EnvioPortalDto.De(p.EnvioAtual, tipo), RegraPeriodos.PodeEnviar(p.Situacao, tipo.Ativo)))
            .ToList();
}

/// <summary>Documentos GERAIS da empresa autenticada.</summary>
public sealed class ListarDocumentosPortal(IEmpresaPortalAtual atual, IEmpresaRepositorio empresas, ITipoDocumentoRepositorio tipos,
    IEnvioRepositorio envios, TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<DocumentoSituacaoPortalDto>> ExecutarAsync(CancellationToken ct = default)
    {
        var empresa = await empresas.ObterAsync(atual.EmpresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoPortal.Montar(await tipos.ListarAsync(true, Abrangencia.GERAL, ct: ct), await envios.ListarDaEmpresaAsync(atual.EmpresaId, null, ct),
            t => Cobranca.Geral(empresa.CriadoEm, t, hoje), hoje);
    }
}

/// <summary>Histórico de um documento GERAL (tipo POR_OBRA → 404); <c>periodoInicio</c> filtra por período.</summary>
public sealed class ListarHistoricoPortal(IEmpresaPortalAtual atual, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<IReadOnlyList<EnvioPortalDto>> ExecutarAsync(Guid tipoDocumentoId, DateOnly? periodoInicio = null, CancellationToken ct = default)
    {
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || tipo.Abrangencia != Abrangencia.GERAL) throw ErroAplicacao.NaoEncontrado();
        return (await envios.ListarHistoricoAsync(atual.EmpresaId, tipoDocumentoId, null, periodoInicio, ct)).Select(e => EnvioPortalDto.De(e, tipo)).ToList();
    }
}

/// <summary>Períodos de um documento GERAL periódico e ativo da empresa autenticada (POR_OBRA, único ou inativo → 404).</summary>
public sealed class ListarPeriodosPortal(IEmpresaPortalAtual atual, IEmpresaRepositorio empresas, ITipoDocumentoRepositorio tipos,
    IEnvioRepositorio envios, TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<PeriodoPortalDto>> ExecutarAsync(Guid tipoDocumentoId, CancellationToken ct = default)
    {
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || !tipo.Ativo || tipo.Abrangencia != Abrangencia.GERAL || !tipo.Periodicidade.EhPeriodica) throw ErroAplicacao.NaoEncontrado();
        var empresa = await empresas.ObterAsync(atual.EmpresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoPortal.Periodos(tipo, Cobranca.Geral(empresa.CriadoEm, tipo, hoje),
            await envios.ListarHistoricoAsync(atual.EmpresaId, tipo.Id, null, null, ct), hoje);
    }
}

/// <summary>Obras ativas com vínculo ativo da empresa autenticada; com pendência primeiro, depois nome.</summary>
public sealed class ListarObrasPortal(IEmpresaPortalAtual atual, IObraRepositorio obras, IConsultaDocumentos consulta) : ICasoDeUso
{
    public async Task<IReadOnlyList<ObraPortalDto>> ExecutarAsync(CancellationToken ct = default)
    {
        var ativas = (await obras.ListarObrasDaEmpresaAsync(atual.EmpresaId, ct)).Where(o => o.Ativa).ToList();
        var contagens = await consulta.ContarObrasDaEmpresaAsync(atual.EmpresaId, ativas.Select(o => o.Id).ToList(), ct);
        return ativas
            .Select(o => new ObraPortalDto(o.Id, o.Nome, o.Cidade, o.Uf, contagens[o.Id]))
            .OrderBy(o => o.Documentos.Pendentes + o.Documentos.Rejeitados > 0 ? 0 : 1)
            .ThenBy(o => Ordenacao.Chave(o.Nome), StringComparer.Ordinal)
            .ThenBy(o => o.Id)
            .ToList();
    }
}

/// <summary>Documentos da obra (tipos POR_OBRA marcados e ativos) da empresa autenticada.</summary>
public sealed class ListarDocumentosObraPortal(IEmpresaPortalAtual atual, ObraDoPortal alcance, IObraRepositorio obras, ITipoDocumentoRepositorio tipos,
    IEnvioRepositorio envios, TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<DocumentoSituacaoPortalDto>> ExecutarAsync(Guid obraId, CancellationToken ct = default)
    {
        await alcance.GarantirAsync(obraId, ct);
        var vinculo = await alcance.VinculoAsync(obraId, ct);
        var marcados = (await obras.ListarTiposMarcadosAsync(obraId, ct)).ToDictionary(m => m.TipoDocumentoId);
        var exigidos = (await tipos.ListarAsync(true, Abrangencia.POR_OBRA, ct: ct)).Where(t => marcados.ContainsKey(t.Id));
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoPortal.Montar(exigidos, await envios.ListarDaEmpresaAsync(atual.EmpresaId, obraId, ct),
            t => Cobranca.Obra(vinculo, marcados[t.Id].MarcadoEm, t, hoje), hoje);
    }
}

/// <summary>Histórico do documento da obra (tipo não marcado → 404); <c>periodoInicio</c> filtra por período.</summary>
public sealed class ListarHistoricoObraPortal(IEmpresaPortalAtual atual, ObraDoPortal alcance, IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<IReadOnlyList<EnvioPortalDto>> ExecutarAsync(Guid obraId, Guid tipoDocumentoId, DateOnly? periodoInicio = null,
        CancellationToken ct = default)
    {
        await alcance.GarantirAsync(obraId, ct);
        var (tipo, _) = await alcance.TipoMarcadoAsync(obraId, tipoDocumentoId, exigirAtivo: false, ct);
        return (await envios.ListarHistoricoAsync(atual.EmpresaId, tipoDocumentoId, obraId, periodoInicio, ct)).Select(e => EnvioPortalDto.De(e, tipo)).ToList();
    }
}

/// <summary>Períodos do documento periódico da obra (mesmo alcance da 002 R8; tipo não marcado, inativo ou único → 404).</summary>
public sealed class ListarPeriodosObraPortal(IEmpresaPortalAtual atual, ObraDoPortal alcance, IEnvioRepositorio envios, TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<PeriodoPortalDto>> ExecutarAsync(Guid obraId, Guid tipoDocumentoId, CancellationToken ct = default)
    {
        await alcance.GarantirAsync(obraId, ct);
        var (tipo, marcacao) = await alcance.TipoMarcadoAsync(obraId, tipoDocumentoId, exigirAtivo: true, ct);
        if (!tipo.Periodicidade.EhPeriodica) throw ErroAplicacao.NaoEncontrado();
        var vinculo = await alcance.VinculoAsync(obraId, ct);
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoPortal.Periodos(tipo, Cobranca.Obra(vinculo, marcacao.MarcadoEm, tipo, hoje),
            await envios.ListarHistoricoAsync(atual.EmpresaId, tipo.Id, obraId, null, ct), hoje);
    }
}

/// <summary>Arquivo de envio da própria empresa; envio de obra exige a obra no alcance (vínculo ativo, obra ativa).</summary>
public sealed class BaixarArquivoPortal(IEmpresaPortalAtual atual, IEnvioRepositorio envios, ObraDoPortal alcance, IArmazenamentoArquivos armazenamento,
    IRegistroAuditoria auditoria, IUnidadeTrabalho uow) : ICasoDeUso
{
    public async Task<ArquivoDto> ExecutarAsync(Guid envioId, CancellationToken ct = default)
    {
        var envio = await envios.ObterAsync(envioId, ct);
        // Envio de outra empresa → 404 (nunca 403, para não revelar existência).
        if (envio is null || envio.EmpresaId != atual.EmpresaId) throw ErroAplicacao.NaoEncontrado();
        if (envio.ObraId is { } obraId) await alcance.GarantirAsync(obraId, ct);
        auditoria.Registrar(AtorAuditoria.Empresa, atual.EmpresaId.ToString(), AcaoAuditoria.ArquivoBaixado, "ENVIO", envio.Id.ToString());
        await uow.SalvarAsync(ct);
        return new ArquivoDto(await armazenamento.AbrirLeituraAsync(envio.ChaveArmazenamento, ct), envio.ContentType, envio.NomeArquivo);
    }
}
