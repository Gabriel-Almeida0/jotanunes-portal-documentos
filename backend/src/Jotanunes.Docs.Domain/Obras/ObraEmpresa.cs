namespace Jotanunes.Docs.Domain.Obras;

/// <summary>Vínculo obra–empresa (PK composta).</summary>
public sealed class ObraEmpresa
{
    private ObraEmpresa() { }

    public ObraEmpresa(Guid obraId, Guid empresaId, string vinculadoPorLogin, DateTimeOffset agora)
    {
        ObraId = obraId;
        EmpresaId = empresaId;
        VinculadoPorLogin = vinculadoPorLogin;
        VinculadoEm = agora;
    }

    public Guid ObraId { get; private set; }
    public Guid EmpresaId { get; private set; }
    public DateTimeOffset VinculadoEm { get; private set; }
    public string VinculadoPorLogin { get; private set; } = string.Empty;
}
