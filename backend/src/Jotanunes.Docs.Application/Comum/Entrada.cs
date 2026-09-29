using Jotanunes.Docs.Application.Erros;

namespace Jotanunes.Docs.Application.Comum;

internal static class Entrada
{
    public static bool Obrigatorio(bool? valor, string campo) =>
        valor ?? throw ErroAplicacao.Validacao(campo, "Informe se está ativo(a).");

    public static TEnum? EnumOpcional<TEnum>(string? valor, string campo) where TEnum : struct, Enum
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        if (Enum.GetNames<TEnum>().Contains(valor, StringComparer.Ordinal)) return Enum.Parse<TEnum>(valor);
        throw ErroAplicacao.Validacao(campo, "Valor inválido.");
    }

    public static string? Busca(string? busca)
    {
        var b = busca?.Trim();
        if (string.IsNullOrEmpty(b)) return null;
        if (b.Length > 100) throw ErroAplicacao.Validacao("busca", "A busca deve ter no máximo 100 caracteres.");
        return b;
    }
}
