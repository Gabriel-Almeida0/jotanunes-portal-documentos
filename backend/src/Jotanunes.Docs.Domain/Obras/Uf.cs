namespace Jotanunes.Docs.Domain.Obras;

#pragma warning disable CS1591
public enum Uf
{
    AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO,
}
#pragma warning restore CS1591

public static class Ufs
{
    private static readonly Dictionary<string, Uf> PorSigla =
        Enum.GetValues<Uf>().ToDictionary(u => u.ToString(), u => u, StringComparer.OrdinalIgnoreCase);

    public static bool TryParse(string? sigla, out Uf uf)
    {
        uf = default;
        return sigla is not null && PorSigla.TryGetValue(sigla.Trim(), out uf);
    }
}
