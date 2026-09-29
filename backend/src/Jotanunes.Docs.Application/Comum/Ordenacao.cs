using System.Globalization;
using System.Text;

namespace Jotanunes.Docs.Application.Comum;

/// <summary>Chave de ordenação alfabética sem diferenciar maiúsculas/acentos (igual à usada no banco).</summary>
public static class Ordenacao
{
    public static string Chave(string texto)
    {
        var sb = new StringBuilder(texto.Length);
        foreach (var c in texto.ToLowerInvariant().Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        return sb.ToString();
    }
}
