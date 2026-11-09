using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Application.Envios;

/// <summary>Fila/busca de envios. <c>obraId</c> = envios desta obra; <c>somenteGerais</c> = envios sem obra (não combinam).</summary>
public sealed class ListarFilaEnvios(IEnvioRepositorio envios) : ICasoDeUso
{
    public Task<PaginaResultado<EnvioFilaDto>> ExecutarAsync(string? status, Guid? obraId, bool? somenteGerais, Guid? empresaId, Guid? tipoDocumentoId,
        int? pagina, int? tamanhoPagina, bool? comAtraso = null, CancellationToken ct = default)
    {
        var s = Entrada.EnumOpcional<StatusEnvio>(status, "status") ?? StatusEnvio.EM_ANALISE;
        var gerais = somenteGerais == true;
        if (gerais && obraId is not null)
        {
            throw ErroAplicacao.Validacao("somenteGerais", "Escolha uma obra ou somente os documentos gerais, não os dois.");
        }
        return envios.ListarFilaAsync(new FiltroEnvios(s, obraId, empresaId, tipoDocumentoId, gerais, comAtraso == true), Paginacao.Criar(pagina, tamanhoPagina), ct);
    }
}

public sealed class ObterEnvio(IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<EnvioFilaDto> ExecutarAsync(Guid id, CancellationToken ct = default) =>
        await envios.ObterFilaAsync(id, ct) ?? throw ErroAplicacao.NaoEncontrado();
}

public sealed class BaixarArquivoFluig(IEnvioRepositorio envios, IArmazenamentoArquivos armazenamento, IRegistroAuditoria auditoria,
    IUnidadeTrabalho uow, IUsuarioFluigAtual usuario) : ICasoDeUso
{
    public async Task<ArquivoDto> ExecutarAsync(Guid envioId, CancellationToken ct = default)
    {
        var envio = await envios.ObterAsync(envioId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, AcaoAuditoria.ArquivoBaixado, "ENVIO", envio.Id.ToString());
        await uow.SalvarAsync(ct);
        return new ArquivoDto(await armazenamento.AbrirLeituraAsync(envio.ChaveArmazenamento, ct), envio.ContentType, envio.NomeArquivo);
    }
}

/// <summary>Registra a decisão com atualização condicional (WHERE status = EM_ANALISE); perdedor → 409.</summary>
public sealed class DecisaoEnvio(IEnvioRepositorio envios, IUnidadeTrabalho uow, IRegistroAuditoria auditoria, IUsuarioFluigAtual usuario,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<EnvioDocumento> DecidirAsync(Guid envioId, Action<EnvioDocumento, DateTimeOffset> decidir, string acao, CancellationToken ct)
    {
        var envio = await envios.ObterAsync(envioId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        try { decidir(envio, relogio.GetUtcNow()); }
        catch (ErroDominio e) { throw ErroAplicacao.De(e); }

        await using var tx = await uow.IniciarTransacaoAsync(ct);
        if (!await envios.RegistrarDecisaoAsync(envio, ct))
        {
            await tx.DesfazerAsync(CancellationToken.None);
            throw new ErroAplicacao(CodigoErro.ENVIO_JA_ANALISADO);
        }
        auditoria.Registrar(AtorAuditoria.Fluig, usuario.Login, acao, "ENVIO", envio.Id.ToString());
        await uow.SalvarAsync(ct);
        await tx.ConfirmarAsync(ct);
        return envio;
    }
}

public sealed class AprovarEnvio(DecisaoEnvio decisao, IUsuarioFluigAtual usuario, ITipoDocumentoRepositorio tipos) : ICasoDeUso
{
    public async Task<EnvioDto> ExecutarAsync(Guid envioId, CancellationToken ct = default)
    {
        var envio = await decisao.DecidirAsync(envioId, (e, agora) => e.Aprovar(usuario.Login, usuario.Nome, agora), AcaoAuditoria.EnvioAprovado, ct);
        return EnvioDto.De(envio, await tipos.ObterAsync(envio.TipoDocumentoId, ct) ?? throw ErroAplicacao.NaoEncontrado());
    }
}

public sealed class RejeitarEnvio(
    DecisaoEnvio decisao,
    IUsuarioFluigAtual usuario,
    IEmpresaRepositorio empresas,
    ITipoDocumentoRepositorio tipos,
    IObraRepositorio obras,
    IEnviadorEmail email,
    IOptions<ConfiguracaoPortal> portal,
    ILogger<RejeitarEnvio> log) : ICasoDeUso
{
    public async Task<EnvioDto> ExecutarAsync(Guid envioId, RejeicaoInput entrada, CancellationToken ct = default)
    {
        var envio = await decisao.DecidirAsync(envioId, (e, agora) => e.Rejeitar(usuario.Login, usuario.Nome, entrada.Motivo, agora),
            AcaoAuditoria.EnvioRejeitado, ct);

        var tipo = await tipos.ObterAsync(envio.TipoDocumentoId, ct) ?? throw ErroAplicacao.NaoEncontrado();

        // Falha no e-mail de rejeição não desfaz a decisão: só registra aviso.
        try
        {
            var empresa = await empresas.ObterAsync(envio.EmpresaId, ct);
            var obra = envio.ObraId is { } obraId ? await obras.ObterAsync(obraId, ct) : null;
            if (empresa is not null && (envio.ObraId is null || obra is not null))
            {
                var baseUrl = portal.Value.BaseUrl.TrimEnd('/');
                var periodo = PeriodoRefDto.De(envio, tipo);
                var link = obra is null ? $"{baseUrl}/documentos" : $"{baseUrl}/obras/{obra.Id}";
                if (periodo is not null) link = obra is null ? $"{baseUrl}/documentos/{tipo.Id}/periodos" : $"{link}/documentos/{tipo.Id}/periodos";
                await email.EnviarAsync(ModelosEmail.Rejeicao(empresa.EmailContato, empresa.RazaoSocial, tipo.Nome, envio.MotivoRejeicao!, link,
                    obra?.Nome, periodo?.Rotulo), ct);
            }
        }
        catch (Exception ex) when (ex is FalhaEnvioEmail or HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(ex, "Falha ao enviar o e-mail de rejeição do envio {EnvioId}", envio.Id);
        }
        return EnvioDto.De(envio, tipo);
    }
}

internal static class SituacaoDocumentos
{
    /// <summary>Situação de cada tipo (periódico: situação resumida; <paramref name="cobranca"/> dá a janela de cobrança).</summary>
    public static IReadOnlyList<DocumentoSituacaoDto> Montar(IEnumerable<TipoDocumento> tipos, IEnumerable<EnvioDocumento> envios,
        Func<TipoDocumento, Cobranca> cobranca, DateOnly hoje)
    {
        var porTipo = envios.ToLookup(e => e.TipoDocumentoId);
        return tipos.Select(t =>
        {
            var lista = porTipo[t.Id].ToList();
            var a = Periodicos.Avaliar(t, lista, () => cobranca(t), hoje);
            return new DocumentoSituacaoDto(TipoDocumentoRefDto.De(t), a.Situacao, a.EnvioAtual is null ? null : EnvioDto.De(a.EnvioAtual, t), lista.Count,
                a.Atrasado, a.Resumo is null ? null : ResumoPeriodosDto.De(a.Resumo));
        }).ToList();
    }

    /// <summary>Períodos (mais recente primeiro) na visão da Jotanunes (com quem analisou).</summary>
    public static IReadOnlyList<PeriodoDto> Periodos(TipoDocumento tipo, Cobranca cobranca, IEnumerable<EnvioDocumento> envios, DateOnly hoje) =>
        Periodicos.Detalhar(tipo, cobranca, envios, hoje)
            .OrderByDescending(p => p.Periodo.Inicio)
            .Select(p => new PeriodoDto(p.Periodo.Inicio, p.Periodo.Fim, p.Periodo.Rotulo, p.Periodo.Prazo, p.Situacao, p.Atrasado,
                p.EnvioAtual is null ? null : EnvioDto.De(p.EnvioAtual, tipo), p.QuantidadeEnvios))
            .ToList();
}

/// <summary>Documentos GERAIS da empresa (tipos GERAL ativos; envios sem obra).</summary>
public sealed class ListarDocumentosEmpresa(IEmpresaRepositorio empresas, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<DocumentoSituacaoDto>> ExecutarAsync(Guid empresaId, CancellationToken ct = default)
    {
        var empresa = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoDocumentos.Montar(await tipos.ListarAsync(true, Abrangencia.GERAL, ct: ct), await envios.ListarDaEmpresaAsync(empresaId, null, ct),
            t => Cobranca.Geral(empresa.CriadoEm, t, hoje), hoje);
    }
}

/// <summary>Histórico de um documento GERAL (tipo POR_OBRA → 404); <c>periodoInicio</c> filtra por período.</summary>
public sealed class ListarHistoricoEnviosEmpresa(IEmpresaRepositorio empresas, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<IReadOnlyList<EnvioDto>> ExecutarAsync(Guid empresaId, Guid tipoDocumentoId, DateOnly? periodoInicio = null,
        CancellationToken ct = default)
    {
        _ = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || tipo.Abrangencia != Abrangencia.GERAL) throw ErroAplicacao.NaoEncontrado();
        return (await envios.ListarHistoricoAsync(empresaId, tipoDocumentoId, null, periodoInicio, ct)).Select(e => EnvioDto.De(e, tipo)).ToList();
    }
}

/// <summary>Períodos do documento GERAL periódico da empresa (POR_OBRA ou único → 404; inclui tipo inativo, para histórico).</summary>
public sealed class ListarPeriodosEmpresa(IEmpresaRepositorio empresas, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<PeriodoDto>> ExecutarAsync(Guid empresaId, Guid tipoDocumentoId, CancellationToken ct = default)
    {
        var empresa = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || tipo.Abrangencia != Abrangencia.GERAL || !tipo.Periodicidade.EhPeriodica) throw ErroAplicacao.NaoEncontrado();
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoDocumentos.Periodos(tipo, Cobranca.Geral(empresa.CriadoEm, tipo, hoje),
            await envios.ListarHistoricoAsync(empresaId, tipo.Id, null, null, ct), hoje);
    }
}

/// <summary>Obra + vínculo (ativo ou encerrado) da empresa; sem vínculo → 404.</summary>
internal static class VinculoConsultado
{
    public static async Task<ObraEmpresa> GarantirAsync(IObraRepositorio obras, Guid obraId, Guid empresaId, CancellationToken ct)
    {
        _ = await obras.ObterAsync(obraId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        return await obras.ObterVinculoAsync(obraId, empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
    }
}

/// <summary>Documentos da obra para a empresa (tipos marcados e ativos; responde também com vínculo encerrado).</summary>
public sealed class ListarDocumentosEmpresaObra(IObraRepositorio obras, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<DocumentoSituacaoDto>> ExecutarAsync(Guid obraId, Guid empresaId, CancellationToken ct = default)
    {
        var vinculo = await VinculoConsultado.GarantirAsync(obras, obraId, empresaId, ct);
        var marcados = (await obras.ListarTiposMarcadosAsync(obraId, ct)).ToDictionary(m => m.TipoDocumentoId);
        var exigidos = (await tipos.ListarAsync(true, Abrangencia.POR_OBRA, ct: ct)).Where(t => marcados.ContainsKey(t.Id));
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoDocumentos.Montar(exigidos, await envios.ListarDaEmpresaAsync(empresaId, obraId, ct),
            t => Cobranca.Obra(vinculo, marcados[t.Id].MarcadoEm, t, hoje), hoje);
    }
}

/// <summary>Histórico do documento da obra (inclui tipo desmarcado ou inativo; tipo GERAL → 404); <c>periodoInicio</c> filtra por período.</summary>
public sealed class ListarHistoricoEnviosEmpresaObra(IObraRepositorio obras, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<IReadOnlyList<EnvioDto>> ExecutarAsync(Guid obraId, Guid empresaId, Guid tipoDocumentoId, DateOnly? periodoInicio = null,
        CancellationToken ct = default)
    {
        await VinculoConsultado.GarantirAsync(obras, obraId, empresaId, ct);
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || tipo.Abrangencia != Abrangencia.POR_OBRA) throw ErroAplicacao.NaoEncontrado();
        return (await envios.ListarHistoricoAsync(empresaId, tipoDocumentoId, obraId, periodoInicio, ct)).Select(e => EnvioDto.De(e, tipo)).ToList();
    }
}

/// <summary>
/// Períodos do documento periódico da obra para a empresa (responde também com vínculo encerrado: períodos até o
/// encerramento). Sem vínculo, tipo não marcado, GERAL ou único → 404.
/// </summary>
public sealed class ListarPeriodosEmpresaObra(IObraRepositorio obras, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<IReadOnlyList<PeriodoDto>> ExecutarAsync(Guid obraId, Guid empresaId, Guid tipoDocumentoId, CancellationToken ct = default)
    {
        var vinculo = await VinculoConsultado.GarantirAsync(obras, obraId, empresaId, ct);
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || tipo.Abrangencia != Abrangencia.POR_OBRA || !tipo.Periodicidade.EhPeriodica) throw ErroAplicacao.NaoEncontrado();
        var marcacao = await obras.ObterMarcacaoAsync(obraId, tipoDocumentoId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var hoje = Periodicos.Hoje(relogio);
        return SituacaoDocumentos.Periodos(tipo, Cobranca.Obra(vinculo, marcacao.MarcadoEm, tipo, hoje),
            await envios.ListarHistoricoAsync(empresaId, tipo.Id, obraId, null, ct), hoje);
    }
}
