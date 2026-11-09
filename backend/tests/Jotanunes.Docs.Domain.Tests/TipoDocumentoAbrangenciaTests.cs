using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Tests;

public class TipoDocumentoAbrangenciaTests
{
    private static readonly DateTimeOffset Agora = new(2026, 10, 26, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Criar_sem_abrangencia_nasce_geral()
    {
        Assert.Equal(Abrangencia.GERAL, TipoDocumento.Criar("Cartão CNPJ", null, "x", Agora).Abrangencia);
    }

    [Fact]
    public void Criar_por_obra()
    {
        Assert.Equal(Abrangencia.POR_OBRA, TipoDocumento.Criar("ART da obra", null, "x", Agora, Abrangencia.POR_OBRA).Abrangencia);
    }

    [Fact]
    public void Trocar_sem_envios_muda_e_informa()
    {
        var t = TipoDocumento.Criar("ART da obra", null, "x", Agora);
        Assert.True(t.TrocarAbrangencia(Abrangencia.POR_OBRA, temEnvios: false));
        Assert.Equal(Abrangencia.POR_OBRA, t.Abrangencia);
        Assert.True(t.TrocarAbrangencia(Abrangencia.GERAL, temEnvios: false));
        Assert.Equal(Abrangencia.GERAL, t.Abrangencia);
    }

    [Fact]
    public void Trocar_com_envios_lanca_abrangencia_imutavel()
    {
        var t = TipoDocumento.Criar("ART da obra", null, "x", Agora, Abrangencia.POR_OBRA);
        var erro = Assert.Throws<ErroDominio>(() => t.TrocarAbrangencia(Abrangencia.GERAL, temEnvios: true));
        Assert.Equal(TipoErroDominio.AbrangenciaImutavel, erro.Tipo);
        Assert.Equal(Abrangencia.POR_OBRA, t.Abrangencia);
    }

    [Fact]
    public void Manter_a_mesma_abrangencia_com_envios_nao_e_erro()
    {
        var t = TipoDocumento.Criar("ART da obra", null, "x", Agora, Abrangencia.POR_OBRA);
        Assert.False(t.TrocarAbrangencia(Abrangencia.POR_OBRA, temEnvios: true));
    }
}
