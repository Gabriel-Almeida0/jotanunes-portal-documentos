namespace Jotanunes.Docs.Domain.Obras;

/// <summary>Tipo de documento POR_OBRA marcado como exigido numa obra (PK composta; data-model 002 §2).</summary>
public sealed class ObraTipoDocumento
{
    private ObraTipoDocumento() { }

    public ObraTipoDocumento(Guid obraId, Guid tipoDocumentoId, string marcadoPorLogin, DateTimeOffset agora)
    {
        ObraId = obraId;
        TipoDocumentoId = tipoDocumentoId;
        MarcadoPorLogin = marcadoPorLogin;
        MarcadoEm = agora;
    }

    public Guid ObraId { get; private set; }
    public Guid TipoDocumentoId { get; private set; }
    public DateTimeOffset MarcadoEm { get; private set; }
    public string MarcadoPorLogin { get; private set; } = string.Empty;
}
