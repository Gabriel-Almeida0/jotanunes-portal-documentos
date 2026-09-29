using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Emails;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Envios;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Application.Envios;

public sealed class ListarFilaEnvios(IEnvioRepositorio envios) : ICasoDeUso
{
    public Task<PaginaResultado<EnvioFilaDto>> ExecutarAsync(string? status, Guid? obraId, Guid? empresaId, Guid? tipoDocumentoId,
        int? pagina, int? tamanhoPagina, CancellationToken ct = default)
    {
        var s = Entrada.EnumOpcional<StatusEnvio>(status, "status") ?? StatusEnvio.EM_ANALISE;
        return envios.ListarFilaAsync(new FiltroEnvios(s, obraId, empresaId, tipoDocumentoId), Paginacao.Criar(pagina, tamanhoPagina), ct);
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

public sealed class AprovarEnvio(DecisaoEnvio decisao, IUsuarioFluigAtual usuario) : ICasoDeUso
{
    public async Task<EnvioDto> ExecutarAsync(Guid envioId, CancellationToken ct = default) =>
        EnvioDto.De(await decisao.DecidirAsync(envioId, (e, agora) => e.Aprovar(usuario.Login, usuario.Nome, agora), AcaoAuditoria.EnvioAprovado, ct));
}

public sealed class RejeitarEnvio(
    DecisaoEnvio decisao,
    IUsuarioFluigAtual usuario,
    IEmpresaRepositorio empresas,
    ITipoDocumentoRepositorio tipos,
    IEnviadorEmail email,
    IOptions<ConfiguracaoPortal> portal,
    ILogger<RejeitarEnvio> log) : ICasoDeUso
{
    public async Task<EnvioDto> ExecutarAsync(Guid envioId, RejeicaoInput entrada, CancellationToken ct = default)
    {
        var envio = await decisao.DecidirAsync(envioId, (e, agora) => e.Rejeitar(usuario.Login, usuario.Nome, entrada.Motivo, agora),
            AcaoAuditoria.EnvioRejeitado, ct);

        // Falha no e-mail de rejeição não desfaz a decisão: só registra aviso.
        try
        {
            var empresa = await empresas.ObterAsync(envio.EmpresaId, ct);
            var tipo = await tipos.ObterAsync(envio.TipoDocumentoId, ct);
            if (empresa is not null && tipo is not null)
            {
                var link = $"{portal.Value.BaseUrl.TrimEnd('/')}/documentos";
                await email.EnviarAsync(ModelosEmail.Rejeicao(empresa.EmailContato, empresa.RazaoSocial, tipo.Nome, envio.MotivoRejeicao!, link), ct);
            }
        }
        catch (Exception ex) when (ex is FalhaEnvioEmail or HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(ex, "Falha ao enviar o e-mail de rejeição do envio {EnvioId}", envio.Id);
        }
        return EnvioDto.De(envio);
    }
}

public sealed class ListarDocumentosEmpresa(IEmpresaRepositorio empresas, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<IReadOnlyList<DocumentoSituacaoDto>> ExecutarAsync(Guid empresaId, CancellationToken ct = default)
    {
        _ = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        var ativos = await tipos.ListarAsync(true, ct);
        var daEmpresa = (await envios.ListarDaEmpresaAsync(empresaId, ct)).ToLookup(e => e.TipoDocumentoId);
        return ativos.Select(t =>
        {
            var lista = daEmpresa[t.Id].ToList();
            var (situacao, atualEnvio) = RegraSituacaoDocumento.De(lista);
            return new DocumentoSituacaoDto(TipoDocumentoRefDto.De(t), situacao, atualEnvio is null ? null : EnvioDto.De(atualEnvio), lista.Count);
        }).ToList();
    }
}

public sealed class ListarHistoricoEnviosEmpresa(IEmpresaRepositorio empresas, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<IReadOnlyList<EnvioDto>> ExecutarAsync(Guid empresaId, Guid tipoDocumentoId, CancellationToken ct = default)
    {
        _ = await empresas.ObterAsync(empresaId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        _ = await tipos.ObterAsync(tipoDocumentoId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        return (await envios.ListarHistoricoAsync(empresaId, tipoDocumentoId, ct)).Select(EnvioDto.De).ToList();
    }
}
