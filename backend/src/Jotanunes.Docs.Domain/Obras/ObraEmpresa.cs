namespace Jotanunes.Docs.Domain.Obras;

/// <summary>
/// Vínculo obra–empresa (PK composta). Desvincular encerra o vínculo (histórico preservado); vincular de novo reabre
/// (data-model 002 §3).
/// </summary>
public sealed class ObraEmpresa
{
    private ObraEmpresa() { }

    public ObraEmpresa(Guid obraId, Guid empresaId, string vinculadoPorLogin, DateTimeOffset agora)
    {
        ObraId = obraId;
        EmpresaId = empresaId;
        VinculadoPorLogin = vinculadoPorLogin;
        VinculadoEm = agora;
        Ativo = true;
    }

    public Guid ObraId { get; private set; }
    public Guid EmpresaId { get; private set; }
    public DateTimeOffset VinculadoEm { get; private set; }
    public string VinculadoPorLogin { get; private set; } = string.Empty;
    public bool Ativo { get; private set; } = true;
    public DateTimeOffset? EncerradoEm { get; private set; }
    public string? EncerradoPorLogin { get; private set; }

    /// <returns>false se já estava encerrado (nada muda).</returns>
    public bool Encerrar(string autorLogin, DateTimeOffset agora)
    {
        if (!Ativo) return false;
        Ativo = false;
        EncerradoEm = agora;
        EncerradoPorLogin = autorLogin;
        return true;
    }

    /// <returns>false se já estava ativo (nada muda).</returns>
    public bool Reabrir(string autorLogin, DateTimeOffset agora)
    {
        if (Ativo) return false;
        Ativo = true;
        EncerradoEm = null;
        EncerradoPorLogin = null;
        VinculadoEm = agora;
        VinculadoPorLogin = autorLogin;
        return true;
    }
}
