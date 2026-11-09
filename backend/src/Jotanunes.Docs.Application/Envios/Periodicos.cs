using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Application.Envios;

/// <summary>Janela de cobrança de um documento periódico: períodos do que contém <paramref name="Inicio"/> até o que contém <paramref name="Ate"/>.</summary>
internal sealed record Cobranca(DateOnly Inicio, DateOnly Ate)
{
    /// <summary>Documento geral: o mais recente entre o cadastro da empresa e o início de cobrança do tipo (FR-310).</summary>
    public static Cobranca Geral(DateTimeOffset empresaCriadaEm, TipoDocumento tipo, DateOnly hoje) =>
        new(RegraPeriodos.InicioCobranca(empresaCriadaEm, tipo.CobrancaDesde), hoje);

    /// <summary>
    /// Documento da obra: o mais recente entre o vínculo (ou reabertura), a marcação e o início de cobrança do tipo. Vínculo
    /// encerrado para de gerar períodos na data do encerramento.
    /// </summary>
    public static Cobranca Obra(ObraEmpresa vinculo, DateTimeOffset marcadoEm, TipoDocumento tipo, DateOnly hoje) =>
        new(RegraPeriodos.InicioCobranca(vinculo.VinculadoEm, marcadoEm, tipo.CobrancaDesde),
            vinculo is { Ativo: false, EncerradoEm: { } fim } ? DataLocal.De(fim) : hoje);
}

/// <summary>Situação de um documento (único ou periódico) a partir dos envios do contexto.</summary>
internal sealed record AvaliacaoDocumento(SituacaoDocumento Situacao, EnvioDocumento? EnvioAtual, bool Atrasado, ResumoPeriodico? Resumo);

internal static class Periodicos
{
    public static DateOnly Hoje(TimeProvider relogio) => DataLocal.De(relogio.GetUtcNow());

    /// <summary>Períodos exigidos do tipo periódico com a situação de cada um (ordem cronológica).</summary>
    public static IReadOnlyList<SituacaoPeriodo> Detalhar(TipoDocumento tipo, Cobranca cobranca, IEnumerable<EnvioDocumento> envios, DateOnly hoje) =>
        RegraPeriodos.Avaliar(RegraPeriodos.Exigidos(tipo, cobranca.Inicio, cobranca.Ate), envios, hoje);

    /// <summary>Único: <see cref="RegraSituacaoDocumento.De"/>. Periódico: situação resumida dos períodos (FR-312).</summary>
    public static AvaliacaoDocumento Avaliar(TipoDocumento tipo, IReadOnlyList<EnvioDocumento> envios, Func<Cobranca> cobranca, DateOnly hoje)
    {
        if (!tipo.Periodicidade.EhPeriodica)
        {
            var (situacao, atual) = RegraSituacaoDocumento.De(envios);
            return new AvaliacaoDocumento(situacao, atual, false, null);
        }
        var resumo = RegraPeriodos.Resumir(Detalhar(tipo, cobranca(), envios, hoje));
        return new AvaliacaoDocumento(resumo.Situacao, resumo.EnvioAtual, resumo.Atrasado, resumo);
    }

    /// <summary>
    /// Período do envio (research R7): obrigatório para tipo periódico e proibido para único (400 PERIODO_OBRIGATORIO); tem
    /// de ser o início de um período exigido (senão 404 — inclui período futuro).
    /// </summary>
    public static PeriodoCalculado? ResolverParaEnvio(TipoDocumento tipo, DateOnly? periodoInicio, Func<Cobranca> cobranca)
    {
        if (!tipo.Periodicidade.EhPeriodica)
        {
            if (periodoInicio is not null) throw new ErroAplicacao(CodigoErro.PERIODO_OBRIGATORIO, "Este documento não é periódico: não informe o período.");
            return null;
        }
        if (periodoInicio is not { } inicio) throw new ErroAplicacao(CodigoErro.PERIODO_OBRIGATORIO);
        var c = cobranca();
        return RegraPeriodos.Exigidos(tipo, c.Inicio, c.Ate).FirstOrDefault(p => p.Inicio == inicio) ?? throw ErroAplicacao.NaoEncontrado();
    }
}
