using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;

namespace Jotanunes.Docs.Application.Envios.Recebimento;

/// <summary>
/// Recebe o documento da empresa autenticada (geral ou da obra). A ordem das etapas é parte do contrato:
/// ela decide qual erro sai quando a requisição tem mais de um problema.
/// </summary>
public sealed class ReceberDocumentoPortal(
    ConferirDocumentoExigido documentos,
    InspecionarArquivo inspecao,
    ProtocolarEnvio protocolo) : ICasoDeUso
{
    public async Task<EnvioPortalDto> ExecutarAsync(PedidoDeEnvio pedido, CancellationToken ct = default)
    {
        var documento = await documentos.ConferirAsync(pedido.TipoDocumentoId, pedido.ObraId, ct);         // etapa 3
        var periodo = await ResolverPeriodo.ResolverAsync(documento, pedido.PeriodoInicio, ct);            // etapa 4
        using var arquivo = await inspecao.InspecionarAsync(pedido.Conteudo, ct);                           // etapa 5
        var envio = await protocolo.ProtocolarAsync(documento, periodo, arquivo, pedido.NomeOriginal, ct);  // etapas 6 e 7
        return EnvioPortalDto.De(envio, documento.Tipo);
    }
}
