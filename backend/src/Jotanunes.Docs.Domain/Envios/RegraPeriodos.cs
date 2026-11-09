using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Envios;

/// <summary>Situação de um período exigido (003 data-model §3).</summary>
/// <param name="EnvioAtual">Envio que define a situação (null se PENDENTE_ENVIO ou se calculado só pela situação).</param>
public sealed record SituacaoPeriodo(PeriodoCalculado Periodo, SituacaoDocumento Situacao, EnvioDocumento? EnvioAtual, int QuantidadeEnvios, bool Atrasado)
{
    /// <summary>Pede ação da empresa (PENDENTE_ENVIO ou REJEITADO).</summary>
    public bool PedeAcao => Situacao is SituacaoDocumento.PENDENTE_ENVIO or SituacaoDocumento.REJEITADO;
}

/// <summary>
/// Situação resumida de um documento periódico (FR-312) e contagens dos períodos. Cada período exigido conta uma vez em
/// Pendentes/Rejeitados/EmAnalise/Aprovados pela sua situação (a soma é o número de períodos exigidos);
/// <see cref="Atrasados"/> conta, além disso, os que estão atrasados (sobrepõe Pendentes e Rejeitados).
/// </summary>
/// <param name="Proximo">Período mais antigo que pede ação (PENDENTE_ENVIO ou REJEITADO); null se nenhum.</param>
public sealed record ResumoPeriodico(SituacaoDocumento Situacao, EnvioDocumento? EnvioAtual, bool Atrasado, int Atrasados, int Pendentes,
    int Rejeitados, int EmAnalise, int Aprovados, PeriodoCalculado? Proximo);

public static class RegraPeriodos
{
    /// <summary>
    /// Início da cobrança (FR-310): o mais recente dos marcos (cadastro da empresa ou vínculo/marcação na obra, e
    /// <see cref="TipoDocumento.CobrancaDesde"/>), como data no fuso de Brasília.
    /// </summary>
    public static DateOnly InicioCobranca(params DateTimeOffset[] marcos) => DataLocal.De(marcos.Max());

    /// <summary>Prazo vencido (hoje depois do prazo) com situação PENDENTE_ENVIO ou REJEITADO.</summary>
    public static bool Atrasado(PeriodoCalculado periodo, SituacaoDocumento situacao, DateOnly hoje) =>
        hoje > periodo.Prazo && situacao is SituacaoDocumento.PENDENTE_ENVIO or SituacaoDocumento.REJEITADO;

    /// <summary>Período aceita envio: situação PENDENTE_ENVIO ou REJEITADO e o documento é exigido.</summary>
    public static bool PodeEnviar(SituacaoDocumento situacao, bool exigido) =>
        exigido && situacao is SituacaoDocumento.PENDENTE_ENVIO or SituacaoDocumento.REJEITADO;

    /// <summary>Situação de cada período pelos envios daquele período (<see cref="RegraSituacaoDocumento.De"/>); envios de outros períodos são ignorados.</summary>
    public static IReadOnlyList<SituacaoPeriodo> Avaliar(IReadOnlyList<PeriodoCalculado> periodos, IEnumerable<EnvioDocumento> envios, DateOnly hoje)
    {
        var porPeriodo = envios.Where(e => e.PeriodoInicio is not null).ToLookup(e => e.PeriodoInicio!.Value);
        return periodos.Select(p =>
        {
            var lista = porPeriodo[p.Inicio].ToList();
            var (situacao, atual) = RegraSituacaoDocumento.De(lista);
            return new SituacaoPeriodo(p, situacao, atual, lista.Count, Atrasado(p, situacao, hoje));
        }).ToList();
    }

    /// <summary>Mesma avaliação a partir da situação já agregada de cada período (consultas de contagem; sem envio atual).</summary>
    public static IReadOnlyList<SituacaoPeriodo> Avaliar(IReadOnlyList<PeriodoCalculado> periodos, Func<DateOnly, SituacaoDocumento> situacaoDe,
        DateOnly hoje) =>
        periodos.Select(p =>
        {
            var s = situacaoDe(p.Inicio);
            return new SituacaoPeriodo(p, s, null, 0, Atrasado(p, s, hoje));
        }).ToList();

    /// <summary>
    /// Situação resumida (prioridade Atrasado &gt; Rejeitado &gt; Pendente &gt; Em análise &gt; Aprovado). Para situações que pedem
    /// ação vale o período mais antigo nessa situação; para EM_ANALISE/APROVADO, o mais recente. Sem períodos: PENDENTE_ENVIO.
    /// </summary>
    public static ResumoPeriodico Resumir(IReadOnlyList<SituacaoPeriodo> periodos)
    {
        var ordenados = periodos.OrderBy(p => p.Periodo.Inicio).ToList();
        var atrasados = ordenados.Count(p => p.Atrasado);
        var pendentes = ordenados.Count(p => p.Situacao == SituacaoDocumento.PENDENTE_ENVIO);
        var rejeitados = ordenados.Count(p => p.Situacao == SituacaoDocumento.REJEITADO);
        var emAnalise = ordenados.Count(p => p.Situacao == SituacaoDocumento.EM_ANALISE);
        var aprovados = ordenados.Count(p => p.Situacao == SituacaoDocumento.APROVADO);

        var escolhido = ordenados.FirstOrDefault(p => p.Atrasado)
                        ?? ordenados.FirstOrDefault(p => p.Situacao == SituacaoDocumento.REJEITADO)
                        ?? ordenados.FirstOrDefault(p => p.Situacao == SituacaoDocumento.PENDENTE_ENVIO)
                        ?? ordenados.LastOrDefault(p => p.Situacao == SituacaoDocumento.EM_ANALISE)
                        ?? ordenados.LastOrDefault();
        var proximo = ordenados.FirstOrDefault(p => p.PedeAcao)?.Periodo;
        return new ResumoPeriodico(escolhido?.Situacao ?? SituacaoDocumento.PENDENTE_ENVIO, escolhido?.EnvioAtual, atrasados > 0,
            atrasados, pendentes, rejeitados, emAnalise, aprovados, proximo);
    }

    /// <summary>Períodos exigidos de um tipo periódico, até <paramref name="ate"/> (hoje, ou o fim da cobrança).</summary>
    public static IReadOnlyList<PeriodoCalculado> Exigidos(TipoDocumento tipo, DateOnly inicioCobranca, DateOnly ate) =>
        CalendarioPeriodos.Gerar(tipo.Periodicidade, inicioCobranca, ate);
}
