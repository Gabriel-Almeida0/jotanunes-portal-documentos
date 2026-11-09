using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Application.Envios.Recebimento;

/// <summary>
/// Documento exigido da empresa. A janela de cobrança só é calculada quando o período precisa dela.
/// </summary>
internal sealed record DocumentoExigido(
    TipoDocumento Tipo,
    Guid? ObraId,
    Func<CancellationToken, Task<Cobranca>> Cobranca);

/// <summary>Etapa 3: o tipo (e a obra) existe, está ativo e é exigido da empresa? Senão, 404.</summary>
public sealed class ConferirDocumentoExigido(
    IEmpresaPortalAtual atual,
    IEmpresaRepositorio empresas,
    ITipoDocumentoRepositorio tipos,
    ObraDoPortal alcance,
    TimeProvider relogio) : ICasoDeUso
{
    internal Task<DocumentoExigido> ConferirAsync(Guid tipoDocumentoId, Guid? obraId, CancellationToken ct) =>
        obraId is { } id ? DaObraAsync(id, tipoDocumentoId, ct) : GeralAsync(tipoDocumentoId, ct);

    private async Task<DocumentoExigido> GeralAsync(Guid tipoDocumentoId, CancellationToken ct)
    {
        var tipo = await tipos.ObterAsync(tipoDocumentoId, ct);
        if (tipo is null || !tipo.Ativo || tipo.Abrangencia != Abrangencia.GERAL)
        {
            throw ErroAplicacao.NaoEncontrado();
        }

        return new DocumentoExigido(tipo, null, async c =>
        {
            var empresa = await empresas.ObterAsync(atual.EmpresaId, c) ?? throw ErroAplicacao.NaoEncontrado();
            return Cobranca.Geral(empresa.CriadoEm, tipo, Periodicos.Hoje(relogio));
        });
    }

    private async Task<DocumentoExigido> DaObraAsync(Guid obraId, Guid tipoDocumentoId, CancellationToken ct)
    {
        await alcance.GarantirAsync(obraId, ct);                                                    // obra ativa + vínculo ativo
        var (tipo, marcacao) = await alcance.TipoMarcadoAsync(obraId, tipoDocumentoId, exigirAtivo: true, ct); // POR_OBRA, ativo e marcado

        return new DocumentoExigido(tipo, obraId, async c =>
        {
            var vinculo = await alcance.VinculoAsync(obraId, c);
            return Cobranca.Obra(vinculo, marcacao.MarcadoEm, tipo, Periodicos.Hoje(relogio));
        });
    }
}
