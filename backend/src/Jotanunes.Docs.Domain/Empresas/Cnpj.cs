using System.Text;
using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Domain.Empresas;

/// <summary>
/// CNPJ numérico ou alfanumérico (Receita, jul/2026). Normalizado: 14 caracteres maiúsculos sem máscara;
/// 12 primeiros em [0-9A-Z], 2 últimos (DV) numéricos. DV módulo 11 com valor do caractere = ASCII − 48.
/// </summary>
public sealed record Cnpj
{
    public const string MensagemInvalido = "CNPJ inválido.";
    private static readonly int[] Pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    private static readonly int[] Pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    private Cnpj(string valor) => Valor = valor;

    public string Valor { get; }

    public string Formatado => $"{Valor[..2]}.{Valor[2..5]}.{Valor[5..8]}/{Valor[8..12]}-{Valor[12..]}";

    public static string Normalizar(string? entrada)
    {
        if (string.IsNullOrEmpty(entrada)) return string.Empty;
        var sb = new StringBuilder(entrada.Length);
        foreach (var c in entrada)
        {
            if (c is '.' or '/' or '-' || char.IsWhiteSpace(c)) continue;
            sb.Append(char.ToUpperInvariant(c));
        }
        return sb.ToString();
    }

    public static bool EhValido(string normalizado)
    {
        if (normalizado.Length != 14) return false;
        for (var i = 0; i < 12; i++)
        {
            var c = normalizado[i];
            if (!(c is >= '0' and <= '9' || c is >= 'A' and <= 'Z')) return false;
        }
        if (!char.IsAsciiDigit(normalizado[12]) || !char.IsAsciiDigit(normalizado[13])) return false;
        if (normalizado.All(c => c == normalizado[0])) return false;

        var dv1 = CalcularDv(normalizado.AsSpan(0, 12), Pesos1);
        var dv2 = CalcularDv(normalizado.AsSpan(0, 13), Pesos2);
        return normalizado[12] - '0' == dv1 && normalizado[13] - '0' == dv2;
    }

    public static bool TryCriar(string? entrada, out Cnpj? cnpj)
    {
        var n = Normalizar(entrada);
        cnpj = EhValido(n) ? new Cnpj(n) : null;
        return cnpj is not null;
    }

    public static Cnpj Criar(string? entrada) =>
        TryCriar(entrada, out var cnpj) ? cnpj! : throw ErroDominio.Validacao("cnpj", MensagemInvalido);

    public override string ToString() => Valor;

    private static int CalcularDv(ReadOnlySpan<char> base_, int[] pesos)
    {
        var soma = 0;
        for (var i = 0; i < base_.Length; i++) soma += (base_[i] - 48) * pesos[i];
        var resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
