using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Tests.Periodos;

public class PeriodicidadeTests
{
    private static readonly DateTimeOffset Agora = new(2026, 10, 26, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(UnidadePeriodicidade.MESES, 1, 0)]
    [InlineData(UnidadePeriodicidade.MESES, 24, 90)]
    [InlineData(UnidadePeriodicidade.DIAS, 1, 0)]
    [InlineData(UnidadePeriodicidade.DIAS, 365, 90)]
    public void Limites_aceitos(UnidadePeriodicidade unidade, int intervalo, int prazo)
    {
        var p = Periodicidade.Criar(unidade, intervalo, prazo);
        Assert.Equal((unidade, intervalo, prazo), (p.Unidade, p.Intervalo!.Value, p.PrazoDias!.Value));
        Assert.True(p.EhPeriodica);
    }

    [Theory]
    [InlineData(UnidadePeriodicidade.MESES, 0, 15, "periodicidade.intervalo")]
    [InlineData(UnidadePeriodicidade.MESES, 25, 15, "periodicidade.intervalo")]
    [InlineData(UnidadePeriodicidade.DIAS, 366, 15, "periodicidade.intervalo")]
    [InlineData(UnidadePeriodicidade.DIAS, null, 15, "periodicidade.intervalo")]
    [InlineData(UnidadePeriodicidade.MESES, 1, -1, "periodicidade.prazoDias")]
    [InlineData(UnidadePeriodicidade.MESES, 1, 91, "periodicidade.prazoDias")]
    [InlineData(UnidadePeriodicidade.DIAS, 30, null, "periodicidade.prazoDias")]
    public void Fora_da_faixa_e_erro_de_validacao_no_campo(UnidadePeriodicidade unidade, int? intervalo, int? prazo, string campo)
    {
        var erro = Assert.Throws<ErroDominio>(() => Periodicidade.Criar(unidade, intervalo, prazo));
        Assert.Equal(TipoErroDominio.Validacao, erro.Tipo);
        Assert.True(erro.Erros.ContainsKey(campo));
    }

    [Fact]
    public void Unica_ignora_intervalo_e_prazo()
    {
        var p = Periodicidade.Criar(UnidadePeriodicidade.UNICA, 5, 10);
        Assert.Equal(Periodicidade.Unica(), p);
        Assert.Null(p.Intervalo);
        Assert.Null(p.PrazoDias);
        Assert.False(p.EhPeriodica);
    }

    [Theory]
    [InlineData(UnidadePeriodicidade.UNICA, null, null, "Único")]
    [InlineData(UnidadePeriodicidade.MESES, 1, 15, "Mensal · até o dia 15 do mês seguinte")]
    [InlineData(UnidadePeriodicidade.MESES, 1, 0, "Mensal · até o último dia do período")]
    [InlineData(UnidadePeriodicidade.MESES, 1, 45, "Mensal · até 45 dias após o fim do período")]
    [InlineData(UnidadePeriodicidade.MESES, 2, 10, "Bimestral · até 10 dias após o fim do período")]
    [InlineData(UnidadePeriodicidade.MESES, 3, 10, "Trimestral · até 10 dias após o fim do período")]
    [InlineData(UnidadePeriodicidade.MESES, 6, 1, "Semestral · até 1 dia após o fim do período")]
    [InlineData(UnidadePeriodicidade.MESES, 12, 30, "Anual · até 30 dias após o fim do período")]
    [InlineData(UnidadePeriodicidade.MESES, 4, 5, "A cada 4 meses · até 5 dias após o fim do período")]
    [InlineData(UnidadePeriodicidade.DIAS, 30, 5, "A cada 30 dias · até 5 dias após o fim do período")]
    [InlineData(UnidadePeriodicidade.DIAS, 7, 0, "A cada 7 dias · até o último dia do período")]
    public void Descricao_em_portugues(UnidadePeriodicidade unidade, int? intervalo, int? prazo, string esperado)
    {
        Assert.Equal(esperado, Periodicidade.Criar(unidade, intervalo, prazo).Descricao());
    }

    [Fact]
    public void Tipo_nasce_unico_com_cobranca_desde_a_criacao()
    {
        var t = TipoDocumento.Criar("Cartão CNPJ", null, "x", Agora);
        Assert.Equal(Periodicidade.Unica(), t.Periodicidade);
        Assert.Equal(Agora, t.CobrancaDesde);
    }

    [Fact]
    public void Mudar_regra_com_envios_e_imutavel_mas_prazo_muda()
    {
        var t = TipoDocumento.Criar("Guia do FGTS", null, "x", Agora, periodicidade: Periodicidade.Meses(1, 15));
        var erro = Assert.Throws<ErroDominio>(() => t.AlterarPeriodicidade(Periodicidade.Unica(), temEnvios: true, Agora));
        Assert.Equal(TipoErroDominio.PeriodicidadeImutavel, erro.Tipo);
        Assert.Throws<ErroDominio>(() => t.AlterarPeriodicidade(Periodicidade.Meses(3, 15), temEnvios: true, Agora));
        Assert.True(t.AlterarPeriodicidade(Periodicidade.Meses(1, 20), temEnvios: true, Agora));
        Assert.Equal(20, t.PrazoDias);
        Assert.False(t.AlterarPeriodicidade(Periodicidade.Meses(1, 20), temEnvios: true, Agora));
    }

    [Fact]
    public void Unica_para_periodica_recomeca_a_cobranca_e_reativar_tambem()
    {
        var t = TipoDocumento.Criar("Guia do FGTS", null, "x", Agora);
        var depois = Agora.AddDays(10);
        Assert.True(t.AlterarPeriodicidade(Periodicidade.Meses(1, 15), temEnvios: false, depois));
        Assert.Equal(depois, t.CobrancaDesde);

        t.Atualizar(t.Nome, null, false, "x", depois.AddDays(1));
        Assert.Equal(depois, t.CobrancaDesde); // desativar não muda
        var reativado = depois.AddDays(5);
        t.Atualizar(t.Nome, null, true, "x", reativado);
        Assert.Equal(reativado, t.CobrancaDesde);
        t.Atualizar(t.Nome, null, true, "x", reativado.AddDays(1));
        Assert.Equal(reativado, t.CobrancaDesde); // já ativo: não muda
    }
}
