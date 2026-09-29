using System.Security.Cryptography;
using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Application.Envios;

/// <summary>
/// Recebe o arquivo da empresa autenticada. O id da empresa vem só do token.
/// Ordem: grava o arquivo → grava o registro EM_ANALISE; se o índice parcial recusar, exclui o arquivo.
/// </summary>
public sealed class EnviarDocumento(
    IEmpresaPortalAtual atual,
    ITipoDocumentoRepositorio tipos,
    IEnvioRepositorio envios,
    IUnidadeTrabalho uow,
    IArmazenamentoArquivos armazenamento,
    IDetectorFormato detector,
    IRegistroAuditoria auditoria,
    TimeProvider relogio) : ICasoDeUso
{
    public async Task<EnvioPortalDto> ExecutarAsync(Guid tipoDocumentoId, Stream conteudo, string? nomeOriginal, CancellationToken ct = default)
    {
        var empresaId = atual.EmpresaId;
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || !tipo.Ativo) throw ErroAplicacao.NaoEncontrado();

        using var buffer = new MemoryStream();
        var lido = new byte[81920];
        int n;
        while ((n = await conteudo.ReadAsync(lido, ct)) > 0)
        {
            if (buffer.Length + n > EnvioDocumento.TamanhoMaximoBytes) throw new ErroAplicacao(CodigoErro.ARQUIVO_MUITO_GRANDE);
            buffer.Write(lido, 0, n);
        }
        if (buffer.Length == 0) throw new ErroAplicacao(CodigoErro.ARQUIVO_INVALIDO);

        var (formatoDetectado, integro, sha256) = Analisar(buffer);
        var formato = formatoDetectado ?? throw new ErroAplicacao(CodigoErro.ARQUIVO_TIPO_NAO_SUPORTADO);
        if (!integro) throw new ErroAplicacao(CodigoErro.ARQUIVO_INVALIDO); // truncado/corrompido

        if (await envios.ExisteVivoAsync(empresaId, tipoDocumentoId, ct)) throw new ErroAplicacao(CodigoErro.ENVIO_NAO_PERMITIDO);

        var envio = EnvioDocumento.Criar(Guid.NewGuid(), empresaId, tipoDocumentoId, NomeArquivo.Sanear(nomeOriginal), formato,
            buffer.Length, sha256, relogio.GetUtcNow());

        buffer.Position = 0;
        await armazenamento.SalvarAsync(envio.ChaveArmazenamento, buffer, ct);
        try
        {
            envios.Adicionar(envio);
            auditoria.Registrar(AtorAuditoria.Empresa, empresaId.ToString(), AcaoAuditoria.DocumentoEnviado, "ENVIO", envio.Id.ToString());
            await uow.SalvarAsync(ct);
        }
        catch
        {
            try { await armazenamento.ExcluirAsync(envio.ChaveArmazenamento, CancellationToken.None); }
            catch (IOException) { /* melhor esforço: órfão aceitável na v1 */ }
            throw;
        }
        return EnvioPortalDto.De(envio);
    }

    private (string? Formato, bool Integro, string Sha256) Analisar(MemoryStream buffer)
    {
        var bytes = buffer.GetBuffer().AsSpan(0, (int)buffer.Length);
        var formato = detector.Detectar(bytes);
        var integro = formato is not null && detector.EstaIntegro(formato, bytes);
        return (formato, integro, Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant());
    }
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

public sealed class ListarDocumentosPortal(IEmpresaPortalAtual atual, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios) : ICasoDeUso
{
    private static readonly SituacaoDocumento[] Ordem =
        [SituacaoDocumento.REJEITADO, SituacaoDocumento.PENDENTE_ENVIO, SituacaoDocumento.EM_ANALISE, SituacaoDocumento.APROVADO];

    public async Task<IReadOnlyList<DocumentoSituacaoPortalDto>> ExecutarAsync(CancellationToken ct = default)
    {
        var ativos = await tipos.ListarAsync(true, ct);
        var daEmpresa = (await envios.ListarDaEmpresaAsync(atual.EmpresaId, ct)).ToLookup(e => e.TipoDocumentoId);
        return ativos
            .Select(t =>
            {
                var (situacao, envioAtual) = RegraSituacaoDocumento.De(daEmpresa[t.Id]);
                return new DocumentoSituacaoPortalDto(TipoDocumentoRefDto.De(t), situacao,
                    envioAtual is null ? null : EnvioPortalDto.De(envioAtual), RegraSituacaoDocumento.PodeEnviar(situacao, true, t.Ativo));
            })
            .OrderBy(d => Array.IndexOf(Ordem, d.Situacao))
            .ThenBy(d => Ordenacao.Chave(d.TipoDocumento.Nome), StringComparer.Ordinal)
            .ToList();
    }
}

public sealed class ListarHistoricoPortal(IEmpresaPortalAtual atual, ITipoDocumentoRepositorio tipos, IEnvioRepositorio envios) : ICasoDeUso
{
    public async Task<IReadOnlyList<EnvioPortalDto>> ExecutarAsync(Guid tipoDocumentoId, CancellationToken ct = default)
    {
        _ = await tipos.ObterAsync(tipoDocumentoId, ct) ?? throw ErroAplicacao.NaoEncontrado();
        return (await envios.ListarHistoricoAsync(atual.EmpresaId, tipoDocumentoId, ct)).Select(EnvioPortalDto.De).ToList();
    }
}

public sealed class BaixarArquivoPortal(IEmpresaPortalAtual atual, IEnvioRepositorio envios, IArmazenamentoArquivos armazenamento,
    IRegistroAuditoria auditoria, IUnidadeTrabalho uow) : ICasoDeUso
{
    public async Task<ArquivoDto> ExecutarAsync(Guid envioId, CancellationToken ct = default)
    {
        var envio = await envios.ObterAsync(envioId, ct);
        // Envio de outra empresa → 404 (nunca 403, para não revelar existência).
        if (envio is null || envio.EmpresaId != atual.EmpresaId) throw ErroAplicacao.NaoEncontrado();
        auditoria.Registrar(AtorAuditoria.Empresa, atual.EmpresaId.ToString(), AcaoAuditoria.ArquivoBaixado, "ENVIO", envio.Id.ToString());
        await uow.SalvarAsync(ct);
        return new ArquivoDto(await armazenamento.AbrirLeituraAsync(envio.ChaveArmazenamento, ct), envio.ContentType, envio.NomeArquivo);
    }
}
