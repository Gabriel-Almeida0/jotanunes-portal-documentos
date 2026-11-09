using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Application.Envios.Recebimento;

/// <summary>Etapa 4: período do envio. Null = tipo único sem período informado.</summary>
internal static class ResolverPeriodo
{
    public static async Task<PeriodoCalculado?> ResolverAsync(DocumentoExigido documento, DateOnly? periodoInicio, CancellationToken ct)
    {
        // Tipo único e nada informado: não há período e nem é preciso ler a empresa ou o vínculo.
        if (!documento.Tipo.Periodicidade.EhPeriodica && periodoInicio is null) return null;

        var cobranca = await documento.Cobranca(ct);
        // 400 PERIODO_OBRIGATORIO (faltando ou sobrando) ou 404 (não é início de um período exigido).
        return Periodicos.ResolverParaEnvio(documento.Tipo, periodoInicio, () => cobranca);
    }
}
