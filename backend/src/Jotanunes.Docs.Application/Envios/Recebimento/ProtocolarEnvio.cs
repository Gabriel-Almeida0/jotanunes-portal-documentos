using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Auditoria;
using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Application.Envios.Recebimento;

/// <summary>
/// Etapas 6 e 7: um envio vivo por documento e período (409); grava o arquivo, depois o registro e a auditoria;
/// se o registro falhar, apaga o arquivo.
/// </summary>
public sealed class ProtocolarEnvio(
    IEmpresaPortalAtual atual,
    IEnvioRepositorio envios,
    IUnidadeTrabalho uow,
    IArmazenamentoArquivos armazenamento,
    IRegistroAuditoria auditoria,
    TimeProvider relogio) : ICasoDeUso
{
    internal async Task<EnvioDocumento> ProtocolarAsync(DocumentoExigido documento, PeriodoCalculado? periodo,
        ArquivoInspecionado arquivo, string? nomeOriginal, CancellationToken ct)
    {
        var empresaId = atual.EmpresaId;

        if (await envios.ExisteVivoAsync(empresaId, documento.Tipo.Id, documento.ObraId, periodo?.Inicio, ct))
        {
            throw new ErroAplicacao(CodigoErro.ENVIO_NAO_PERMITIDO);
        }

        var envio = CriarEnvio(empresaId, documento, periodo, arquivo, nomeOriginal);

        await armazenamento.SalvarAsync(envio.ChaveArmazenamento, arquivo.Bytes, ct);
        try
        {
            envios.Adicionar(envio);
            auditoria.Registrar(AtorAuditoria.Empresa, empresaId.ToString(), AcaoAuditoria.DocumentoEnviado, "ENVIO", envio.Id.ToString());
            await uow.SalvarAsync(ct); // a violação do índice ix_envios_documento_vivo vira ENVIO_NAO_PERMITIDO aqui
        }
        catch
        {
            await ApagarArquivoAsync(envio.ChaveArmazenamento);
            throw;
        }
        return envio;
    }

    private EnvioDocumento CriarEnvio(Guid empresaId, DocumentoExigido documento, PeriodoCalculado? periodo,
        ArquivoInspecionado arquivo, string? nomeOriginal)
    {
        try
        {
            return EnvioDocumento.Criar(
                Guid.NewGuid(),
                empresaId,
                documento.Tipo.Id,
                NomeArquivo.Sanear(nomeOriginal),
                arquivo.Formato,
                arquivo.Bytes.Length,
                arquivo.Sha256,
                relogio.GetUtcNow(),
                documento.Tipo.Abrangencia,
                documento.ObraId,
                documento.Tipo.Periodicidade.EhPeriodica,
                periodo);
        }
        catch (ErroDominio e)
        {
            throw ErroAplicacao.De(e);
        }
    }

    private async Task ApagarArquivoAsync(string chave)
    {
        try
        {
            await armazenamento.ExcluirAsync(chave, CancellationToken.None);
        }
        catch (IOException)
        {
            // Melhor esforço: arquivo órfão é aceitável; registro sem arquivo não é.
        }
    }
}
