namespace Jotanunes.Docs.Domain.Empresas;

/// <summary>
/// Falhas de login por CNPJ informado quando não há empresa com senha para ele (CNPJ inexistente,
/// inválido ou empresa nunca convidada). Segue a mesma regra da <see cref="Empresa"/> (5 falhas
/// seguidas → bloqueio de 15 min), para que a sequência de respostas não revele se o CNPJ existe
/// (FR-006, FR-062). A <see cref="Chave"/> é derivada do CNPJ pelo adaptador de persistência: o CNPJ
/// digitado não é guardado em texto puro.
/// </summary>
public sealed class TentativasLoginCnpj
{
    private TentativasLoginCnpj() { }

    public TentativasLoginCnpj(string chave)
    {
        if (string.IsNullOrWhiteSpace(chave)) throw new ArgumentException("Chave obrigatória.", nameof(chave));
        Chave = chave;
    }

    public string Chave { get; private set; } = string.Empty;
    public int TentativasFalhas { get; private set; }
    public DateTimeOffset? BloqueadoAte { get; private set; }
    public DateTimeOffset? UltimaFalhaEm { get; private set; }

    public bool EstaBloqueada(DateTimeOffset agora) => BloqueadoAte is { } ate && ate > agora;

    /// <summary>Registra uma falha. Devolve true quando esta falha causou o bloqueio (mesma regra de <see cref="Empresa.RegistrarFalhaLogin"/>).</summary>
    public bool RegistrarFalha(DateTimeOffset agora)
    {
        UltimaFalhaEm = agora;
        TentativasFalhas++;
        if (TentativasFalhas < Empresa.MaximoFalhasLogin) return false;
        TentativasFalhas = 0;
        BloqueadoAte = agora + Empresa.DuracaoBloqueio;
        return true;
    }
}
