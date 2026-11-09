using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Tests.Periodos;

public class RegraPeriodosTests
{
    private static readonly Periodicidade Mensal = Periodicidade.Meses(1, 15);
    private static readonly DateOnly Hoje = new(2026, 10, 26);
    private static readonly Guid Empresa = Guid.NewGuid(), Tipo = Guid.NewGuid();

    private static DateTimeOffset Em(int m, int d) => new(2026, m, d, 15, 0, 0, TimeSpan.Zero);

    private static EnvioDocumento Envio(int mes, DateTimeOffset quando, StatusEnvio status = StatusEnvio.EM_ANALISE)
    {
        var e = EnvioDocumento.Criar(Guid.NewGuid(), Empresa, Tipo, "g.pdf", "application/pdf", 10, new string('0', 64), quando,
            periodico: true, periodo: CalendarioPeriodos.Periodo(Mensal, new DateOnly(2026, mes, 1)));
        if (status == StatusEnvio.APROVADO) e.Aprovar("a", "A", quando);
        if (status == StatusEnvio.REJEITADO) e.Rejeitar("a", "A", "Ilegível demais", quando);
        return e;
    }

    private static IReadOnlyList<PeriodoCalculado> JulhoAOutubro() => CalendarioPeriodos.Gerar(Mensal, new DateOnly(2026, 7, 5), Hoje);

    [Fact]
    public void Situacao_por_periodo_e_atraso()
    {
        var envios = new[] { Envio(8, Em(9, 20), StatusEnvio.APROVADO), Envio(9, Em(10, 1), StatusEnvio.REJEITADO) };
        var ps = RegraPeriodos.Avaliar(JulhoAOutubro(), envios, Hoje);
        Assert.Equal(new[] { SituacaoDocumento.PENDENTE_ENVIO, SituacaoDocumento.APROVADO, SituacaoDocumento.REJEITADO, SituacaoDocumento.PENDENTE_ENVIO },
            ps.Select(p => p.Situacao));
        // Julho (prazo 15/08) e setembro (prazo 15/10, rejeitado) atrasados; outubro (prazo 15/11) ainda não.
        Assert.Equal(new[] { true, false, true, false }, ps.Select(p => p.Atrasado));
        Assert.Equal(1, ps[1].QuantidadeEnvios);
        Assert.NotNull(ps[2].EnvioAtual);
    }

    [Fact]
    public void Resumo_atrasado_primeiro_contagens_e_proximo()
    {
        var envios = new[] { Envio(8, Em(9, 20), StatusEnvio.APROVADO), Envio(9, Em(10, 1), StatusEnvio.REJEITADO) };
        var r = RegraPeriodos.Resumir(RegraPeriodos.Avaliar(JulhoAOutubro(), envios, Hoje));
        Assert.True(r.Atrasado);
        Assert.Equal(SituacaoDocumento.PENDENTE_ENVIO, r.Situacao); // julho: o atrasado mais antigo
        Assert.Null(r.EnvioAtual);
        // Atrasados sobrepõem pendentes/rejeitados; cada período conta uma vez nas outras quatro.
        Assert.Equal((2, 2, 1, 0, 1), (r.Atrasados, r.Pendentes, r.Rejeitados, r.EmAnalise, r.Aprovados));
        Assert.Equal(new DateOnly(2026, 7, 1), r.Proximo!.Inicio);
    }

    [Fact]
    public void Resumo_sem_atraso_segue_a_prioridade()
    {
        var periodos = JulhoAOutubro();
        SituacaoDocumento Fixa(DateOnly d) => d.Month switch
        {
            7 => SituacaoDocumento.APROVADO,
            8 => SituacaoDocumento.EM_ANALISE,
            9 => SituacaoDocumento.APROVADO,
            _ => SituacaoDocumento.EM_ANALISE,
        };
        var r = RegraPeriodos.Resumir(RegraPeriodos.Avaliar(periodos, Fixa, Hoje));
        Assert.False(r.Atrasado);
        Assert.Equal(SituacaoDocumento.EM_ANALISE, r.Situacao);
        Assert.Null(r.Proximo);

        var tudoAprovado = RegraPeriodos.Resumir(RegraPeriodos.Avaliar(periodos, _ => SituacaoDocumento.APROVADO, Hoje));
        Assert.Equal(SituacaoDocumento.APROVADO, tudoAprovado.Situacao);
        Assert.Equal(4, tudoAprovado.Aprovados);

        // Outubro pendente (no prazo) e o resto aprovado: PENDENTE_ENVIO sem atraso, próximo = outubro.
        var pendente = RegraPeriodos.Resumir(RegraPeriodos.Avaliar(periodos,
            d => d.Month == 10 ? SituacaoDocumento.PENDENTE_ENVIO : SituacaoDocumento.APROVADO, Hoje));
        Assert.Equal((SituacaoDocumento.PENDENTE_ENVIO, false), (pendente.Situacao, pendente.Atrasado));
        Assert.Equal("Outubro/2026", pendente.Proximo!.Rotulo);
        Assert.Equal(new DateOnly(2026, 11, 15), pendente.Proximo.Prazo);

        // Rejeitado no prazo vence pendente.
        var rejeitado = RegraPeriodos.Resumir(RegraPeriodos.Avaliar(periodos,
            d => d.Month == 10 ? SituacaoDocumento.REJEITADO : SituacaoDocumento.APROVADO, Hoje));
        Assert.Equal(SituacaoDocumento.REJEITADO, rejeitado.Situacao);
    }

    [Fact]
    public void Envio_periodico_marca_atraso_pela_data_em_brasilia()
    {
        var setembro = CalendarioPeriodos.Periodo(Mensal, new DateOnly(2026, 9, 1)); // prazo 15/10
        // 15/10 23h em Brasília (16/10 02h UTC): ainda no prazo.
        var noPrazo = EnvioDocumento.Criar(Guid.NewGuid(), Empresa, Tipo, "a.pdf", "application/pdf", 1, new string('0', 64),
            new DateTimeOffset(2026, 10, 16, 2, 0, 0, TimeSpan.Zero), periodico: true, periodo: setembro);
        Assert.False(noPrazo.EnviadoComAtraso);
        Assert.Equal(new DateOnly(2026, 9, 1), noPrazo.PeriodoInicio);
        Assert.Equal(new DateOnly(2026, 9, 30), noPrazo.PeriodoFim);
        var atrasado = EnvioDocumento.Criar(Guid.NewGuid(), Empresa, Tipo, "a.pdf", "application/pdf", 1, new string('0', 64),
            new DateTimeOffset(2026, 10, 16, 3, 0, 0, TimeSpan.Zero), periodico: true, periodo: setembro);
        Assert.True(atrasado.EnviadoComAtraso);
    }

    [Fact]
    public void Periodo_obrigatorio_so_para_periodico()
    {
        var sem = Assert.Throws<ErroDominio>(() => EnvioDocumento.Criar(Guid.NewGuid(), Empresa, Tipo, "a.pdf", "application/pdf", 1,
            new string('0', 64), Em(10, 1), periodico: true));
        Assert.Equal(TipoErroDominio.PeriodoObrigatorio, sem.Tipo);
        var com = Assert.Throws<ErroDominio>(() => EnvioDocumento.Criar(Guid.NewGuid(), Empresa, Tipo, "a.pdf", "application/pdf", 1,
            new string('0', 64), Em(10, 1), periodo: CalendarioPeriodos.Periodo(Mensal, new DateOnly(2026, 9, 1))));
        Assert.Equal(TipoErroDominio.PeriodoObrigatorio, com.Tipo);
        var unico = EnvioDocumento.Criar(Guid.NewGuid(), Empresa, Tipo, "a.pdf", "application/pdf", 1, new string('0', 64), Em(10, 1));
        Assert.Null(unico.PeriodoInicio);
        Assert.False(unico.EnviadoComAtraso);
    }

    [Fact]
    public void Inicio_da_cobranca_e_o_marco_mais_recente_no_fuso_de_brasilia()
    {
        var empresa = new DateTimeOffset(2026, 3, 10, 12, 0, 0, TimeSpan.Zero);
        var tipo = new DateTimeOffset(2026, 5, 1, 1, 0, 0, TimeSpan.Zero); // 30/04 22h em Brasília
        Assert.Equal(new DateOnly(2026, 4, 30), RegraPeriodos.InicioCobranca(empresa, tipo));
    }
}
