using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Tests.Periodos;

public class CalendarioPeriodosTests
{
    private static DateOnly D(int a, int m, int d) => new(a, m, d);

    private static string[] Inicios(IEnumerable<PeriodoCalculado> ps) => ps.Select(p => p.Inicio.ToString("yyyy-MM-dd")).ToArray();

    [Fact]
    public void Mensal_desde_meio_do_mes_comeca_no_dia_1_e_vai_ate_o_mes_em_curso()
    {
        var ps = CalendarioPeriodos.Gerar(Periodicidade.Meses(1, 15), D(2026, 7, 18), D(2026, 10, 26));
        Assert.Equal(new[] { "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01" }, Inicios(ps));
        var julho = ps[0];
        Assert.Equal(D(2026, 7, 31), julho.Fim);
        Assert.Equal(D(2026, 8, 15), julho.Prazo);
        Assert.Equal("Julho/2026", julho.Rotulo);
        Assert.Equal("Outubro/2026", ps[^1].Rotulo);
        Assert.Equal(D(2026, 11, 15), ps[^1].Prazo);
    }

    [Fact]
    public void Trimestral_comecando_em_fevereiro()
    {
        var ps = CalendarioPeriodos.Gerar(Periodicidade.Meses(3, 10), D(2026, 2, 20), D(2026, 10, 26));
        Assert.Equal(new[] { "2026-02-01", "2026-05-01", "2026-08-01" }, Inicios(ps));
        Assert.Equal(D(2026, 4, 30), ps[0].Fim);
        Assert.Equal(D(2026, 5, 10), ps[0].Prazo);
        Assert.Equal("Fev–Abr/2026", ps[0].Rotulo);
        Assert.Equal("Ago–Out/2026", ps[2].Rotulo);
    }

    [Fact]
    public void Anual_rotulos_e_virada_de_ano()
    {
        var jan = CalendarioPeriodos.Gerar(Periodicidade.Meses(12, 30), D(2025, 1, 10), D(2026, 3, 1));
        Assert.Equal(new[] { "2025", "2026" }, jan.Select(p => p.Rotulo));
        Assert.Equal(D(2025, 12, 31), jan[0].Fim);
        Assert.Equal(D(2026, 1, 30), jan[0].Prazo);

        var fev = CalendarioPeriodos.Gerar(Periodicidade.Meses(12, 30), D(2026, 2, 3), D(2027, 2, 1));
        Assert.Equal(new[] { "Fev/2026–Jan/2027", "Fev/2027–Jan/2028" }, fev.Select(p => p.Rotulo));
        Assert.Equal(D(2027, 1, 31), fev[0].Fim);
    }

    [Fact]
    public void Bimestral_cruzando_o_ano()
    {
        var ps = CalendarioPeriodos.Gerar(Periodicidade.Meses(2, 5), D(2026, 11, 5), D(2027, 1, 10));
        Assert.Equal("Nov–Dez/2026", ps[0].Rotulo);
        Assert.Equal("Jan–Fev/2027", ps[1].Rotulo);
        Assert.Equal(D(2027, 2, 28), ps[1].Fim);
    }

    [Fact]
    public void A_cada_30_dias_ancorado_no_dia_de_inicio()
    {
        var ps = CalendarioPeriodos.Gerar(Periodicidade.Dias(30, 5), D(2026, 3, 1), D(2026, 4, 30));
        Assert.Equal(new[] { "2026-03-01", "2026-03-31", "2026-04-30" }, Inicios(ps));
        Assert.Equal(D(2026, 3, 30), ps[0].Fim);
        Assert.Equal(D(2026, 4, 4), ps[0].Prazo);
        Assert.Equal("01/03 a 30/03/2026", ps[0].Rotulo);
        Assert.Equal("31/03 a 29/04/2026", ps[1].Rotulo);
    }

    [Fact]
    public void Dias_cruzando_o_ano_e_um_dia()
    {
        Assert.Equal("28/12/2026 a 26/01/2027", CalendarioPeriodos.Periodo(Periodicidade.Dias(30, 0), D(2026, 12, 28)).Rotulo);
        var umDia = CalendarioPeriodos.Periodo(Periodicidade.Dias(1, 0), D(2026, 5, 2));
        Assert.Equal("02/05/2026", umDia.Rotulo);
        Assert.Equal(umDia.Inicio, umDia.Fim);
    }

    [Fact]
    public void Fevereiro_de_ano_bissexto()
    {
        var ps = CalendarioPeriodos.Gerar(Periodicidade.Meses(1, 0), D(2028, 2, 10), D(2028, 3, 1));
        Assert.Equal(D(2028, 2, 29), ps[0].Fim);
        Assert.Equal(D(2028, 2, 29), ps[0].Prazo);
        Assert.Equal("Fevereiro/2028", ps[0].Rotulo);
        Assert.Equal(D(2027, 2, 28), CalendarioPeriodos.Periodo(Periodicidade.Meses(1, 0), D(2027, 2, 1)).Fim);
    }

    [Fact]
    public void Hoje_no_ultimo_dia_nao_inclui_o_proximo_e_no_primeiro_inclui()
    {
        var p = Periodicidade.Meses(1, 15);
        Assert.Equal(3, CalendarioPeriodos.Gerar(p, D(2026, 8, 1), D(2026, 10, 31)).Count);
        Assert.Equal(4, CalendarioPeriodos.Gerar(p, D(2026, 8, 1), D(2026, 11, 1)).Count);
    }

    [Fact]
    public void Unica_ou_cobranca_futura_nao_gera_periodos()
    {
        Assert.Empty(CalendarioPeriodos.Gerar(Periodicidade.Unica(), D(2026, 1, 1), D(2026, 10, 1)));
        Assert.Empty(CalendarioPeriodos.Gerar(Periodicidade.Dias(10, 0), D(2026, 11, 1), D(2026, 10, 1)));
    }

    [Fact]
    public void Fuso_de_brasilia_23h_utc_menos_3_ainda_e_o_mesmo_dia()
    {
        // 31/10/2026 23h em Brasília = 01/11/2026 02h UTC.
        var instante = new DateTimeOffset(2026, 11, 1, 2, 0, 0, TimeSpan.Zero);
        Assert.Equal(D(2026, 10, 31), DataLocal.De(instante));
        Assert.Equal(D(2026, 11, 1), DataLocal.De(instante.AddHours(1)));
        var ps = CalendarioPeriodos.Gerar(Periodicidade.Meses(1, 0), D(2026, 10, 1), DataLocal.De(instante));
        Assert.Equal("Outubro/2026", Assert.Single(ps).Rotulo);
    }

    [Fact]
    public void Vinte_e_cinco_periodos_em_dois_anos_de_mensal()
    {
        Assert.Equal(25, CalendarioPeriodos.Gerar(Periodicidade.Meses(1, 15), D(2024, 10, 26), D(2026, 10, 26)).Count);
    }
}
