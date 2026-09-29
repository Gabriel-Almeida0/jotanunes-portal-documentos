using System.Text.RegularExpressions;

namespace Jotanunes.Docs.Domain.UsuariosInternos;

/// <summary>
/// Login do usuário interno: <c>trim</c> + minúsculas; depois de normalizado, formato <c>^[a-z0-9._-]{3,100}$</c>
/// (data-model §10). Único sem diferenciar maiúsculas e imutável.
/// </summary>
public sealed partial record LoginUsuario
{
    public const int TamanhoMinimo = 3;
    public const int TamanhoMaximo = 100;
    public const string MensagemInvalido =
        "O login deve ter de 3 a 100 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.";

    private LoginUsuario(string valor) => Valor = valor;

    public string Valor { get; }

    /// <summary><c>trim</c> + minúsculas (sem validar o formato).</summary>
    public static string Normalizar(string? entrada) => (entrada ?? string.Empty).Trim().ToLowerInvariant();

    /// <summary>O texto (já normalizado) tem o formato de login?</summary>
    public static bool EhValido(string? normalizado) => normalizado is not null && Formato().IsMatch(normalizado);

    public static bool TryCriar(string? entrada, out LoginUsuario? login)
    {
        var v = Normalizar(entrada);
        login = EhValido(v) ? new LoginUsuario(v) : null;
        return login is not null;
    }

    public override string ToString() => Valor;

    [GeneratedRegex(@"^[a-z0-9._-]{3,100}\z", RegexOptions.CultureInvariant)]
    private static partial Regex Formato();
}
