namespace Jotanunes.Docs.Domain.Convites;

public enum SituacaoConvite
{
    VALIDO,
    USADO,
    EXPIRADO,
    SUBSTITUIDO,
}

/// <summary>Convite por e-mail. Guarda só o hash (SHA-256 hex) do token do link.</summary>
public sealed class Convite
{
    public static readonly TimeSpan Validade = TimeSpan.FromDays(7);

    private Convite() { }

    public Guid Id { get; private set; }
    public Guid EmpresaId { get; private set; }
    public string EmailDestino { get; private set; } = string.Empty;
    public string TokenHash { get; private set; } = string.Empty;
    public DateTimeOffset EnviadoEm { get; private set; }
    public string EnviadoPorLogin { get; private set; } = string.Empty;
    public string EnviadoPorNome { get; private set; } = string.Empty;
    public DateTimeOffset ExpiraEm { get; private set; }
    public DateTimeOffset? UsadoEm { get; private set; }
    public DateTimeOffset? SubstituidoEm { get; private set; }

    public static Convite Criar(Guid empresaId, string emailDestino, string tokenHash, string enviadoPorLogin,
        string enviadoPorNome, DateTimeOffset agora) => new()
    {
        Id = Guid.NewGuid(),
        EmpresaId = empresaId,
        EmailDestino = emailDestino,
        TokenHash = tokenHash,
        EnviadoEm = agora,
        EnviadoPorLogin = enviadoPorLogin,
        EnviadoPorNome = enviadoPorNome,
        ExpiraEm = agora + Validade,
    };

    public SituacaoConvite Situacao(DateTimeOffset agora)
    {
        if (UsadoEm is not null) return SituacaoConvite.USADO;
        if (SubstituidoEm is not null) return SituacaoConvite.SUBSTITUIDO;
        return ExpiraEm <= agora ? SituacaoConvite.EXPIRADO : SituacaoConvite.VALIDO;
    }

    public void MarcarSubstituido(DateTimeOffset agora) => SubstituidoEm ??= agora;

    public void MarcarUsado(DateTimeOffset agora) => UsadoEm ??= agora;
}
