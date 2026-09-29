using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Application.Tests.Envios;

public class SituacaoDocumentoTests
{
    private static readonly DateTimeOffset T0 = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid Empresa = Guid.NewGuid();
    private static readonly Guid Tipo = Guid.NewGuid();

    private static EnvioDocumento Envio(StatusEnvio status, int minutos, string motivo = "motivo qualquer")
    {
        var e = EnvioDocumento.Criar(Guid.NewGuid(), Empresa, Tipo, "a.pdf", "application/pdf", 10, new string('0', 64), T0.AddMinutes(minutos));
        if (status == StatusEnvio.APROVADO) e.Aprovar("m", "M", T0.AddMinutes(minutos + 1));
        if (status == StatusEnvio.REJEITADO) e.Rejeitar("m", "M", motivo, T0.AddMinutes(minutos + 1));
        return e;
    }

    [Fact]
    public void Sem_envio_pendente()
    {
        var (s, atual) = RegraSituacaoDocumento.De([]);
        Assert.Equal(SituacaoDocumento.PENDENTE_ENVIO, s);
        Assert.Null(atual);
        Assert.True(RegraSituacaoDocumento.PodeEnviar(s, true, true));
    }

    [Fact]
    public void Envio_vivo_define_situacao()
    {
        var emAnalise = Envio(StatusEnvio.EM_ANALISE, 10);
        var (s, atual) = RegraSituacaoDocumento.De([Envio(StatusEnvio.REJEITADO, 0), emAnalise]);
        Assert.Equal(SituacaoDocumento.EM_ANALISE, s);
        Assert.Same(emAnalise, atual);
        Assert.False(RegraSituacaoDocumento.PodeEnviar(s, true, true));

        var aprovado = Envio(StatusEnvio.APROVADO, 20);
        (s, atual) = RegraSituacaoDocumento.De([Envio(StatusEnvio.REJEITADO, 0), aprovado]);
        Assert.Equal(SituacaoDocumento.APROVADO, s);
        Assert.Same(aprovado, atual);
        Assert.False(RegraSituacaoDocumento.PodeEnviar(s, true, true));
    }

    [Fact]
    public void So_rejeitados_devolve_o_motivo_do_mais_recente()
    {
        var antigo = Envio(StatusEnvio.REJEITADO, 0, "motivo antigo");
        var recente = Envio(StatusEnvio.REJEITADO, 30, "motivo recente");
        var (s, atual) = RegraSituacaoDocumento.De([recente, antigo]);
        Assert.Equal(SituacaoDocumento.REJEITADO, s);
        Assert.Equal("motivo recente", atual!.MotivoRejeicao);
        Assert.True(RegraSituacaoDocumento.PodeEnviar(s, true, true));
    }

    [Fact]
    public void Pode_enviar_exige_empresa_e_tipo_ativos()
    {
        Assert.False(RegraSituacaoDocumento.PodeEnviar(SituacaoDocumento.PENDENTE_ENVIO, false, true));
        Assert.False(RegraSituacaoDocumento.PodeEnviar(SituacaoDocumento.REJEITADO, true, false));
    }
}
