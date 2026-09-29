using System.Text.RegularExpressions;

namespace Jotanunes.Docs.Domain.Comum;

/// <summary>E-mail normalizado (trim + minúsculas), máximo 254 caracteres.</summary>
public sealed partial record Email
{
    public const int TamanhoMaximo = 254;

    private Email(string valor) => Valor = valor;

    public string Valor { get; }

    public static bool TryCriar(string? entrada, out Email? email)
    {
        email = null;
        var v = entrada?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(v) || v.Length > TamanhoMaximo || !Formato().IsMatch(v)) return false;
        email = new Email(v);
        return true;
    }

    public override string ToString() => Valor;

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.CultureInvariant)]
    private static partial Regex Formato();
}
