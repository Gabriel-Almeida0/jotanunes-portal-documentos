using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Domain.Tests;

public class EnvioDocumentoTests
{
    private static readonly DateTimeOffset Agora = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);

    private static EnvioDocumento NovoEnvio()
    {
        var id = Guid.NewGuid();
        var empresa = Guid.NewGuid();
        return EnvioDocumento.Criar(id, empresa, Guid.NewGuid(), "cartao.pdf", "application/pdf", 100, new string('0', 64), Agora);
    }

    [Fact]
    public void Novo_envio_em_analise_com_chave_sem_nome_original()
    {
        var e = NovoEnvio();
        Assert.Equal(StatusEnvio.EM_ANALISE, e.Status);
        Assert.Equal($"empresas/{e.EmpresaId:N}/{e.Id:N}", e.ChaveArmazenamento);
        Assert.DoesNotContain("cartao", e.ChaveArmazenamento);
    }

    [Fact]
    public void Aprovar_registra_autor_e_data()
    {
        var e = NovoEnvio();
        e.Aprovar("maria", "Maria Silva", Agora.AddHours(1));
        Assert.Equal(StatusEnvio.APROVADO, e.Status);
        Assert.Equal("maria", e.AnalisadoPorLogin);
        Assert.Equal("Maria Silva", e.AnalisadoPorNome);
        Assert.Equal(Agora.AddHours(1), e.AnalisadoEm);
        Assert.Null(e.MotivoRejeicao);
    }

    [Fact]
    public void Rejeitar_com_motivo_trim()
    {
        var e = NovoEnvio();
        e.Rejeitar("maria", "Maria", "  Documento ilegível  ", Agora);
        Assert.Equal(StatusEnvio.REJEITADO, e.Status);
        Assert.Equal("Documento ilegível", e.MotivoRejeicao);
        Assert.Equal("maria", e.AnalisadoPorLogin);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  abcd  ")]
    public void Rejeitar_motivo_curto(string? motivo)
    {
        var erro = Assert.Throws<ErroDominio>(() => NovoEnvio().Rejeitar("m", "M", motivo, Agora));
        Assert.Equal(TipoErroDominio.Validacao, erro.Tipo);
        Assert.True(erro.Erros.ContainsKey("motivo"));
    }

    [Fact]
    public void Rejeitar_motivo_longo()
    {
        var erro = Assert.Throws<ErroDominio>(() => NovoEnvio().Rejeitar("m", "M", new string('a', 501), Agora));
        Assert.True(erro.Erros.ContainsKey("motivo"));
        NovoEnvio().Rejeitar("m", "M", new string('a', 500), Agora);
    }

    [Fact]
    public void Aprovado_e_rejeitado_sao_imutaveis()
    {
        var a = NovoEnvio();
        a.Aprovar("m", "M", Agora);
        Assert.Equal(TipoErroDominio.TransicaoInvalida, Assert.Throws<ErroDominio>(() => a.Aprovar("m", "M", Agora)).Tipo);
        Assert.Equal(TipoErroDominio.TransicaoInvalida, Assert.Throws<ErroDominio>(() => a.Rejeitar("m", "M", "motivo válido", Agora)).Tipo);

        var r = NovoEnvio();
        r.Rejeitar("m", "M", "motivo válido", Agora);
        Assert.Equal(TipoErroDominio.TransicaoInvalida, Assert.Throws<ErroDominio>(() => r.Aprovar("m", "M", Agora)).Tipo);
        Assert.Equal(StatusEnvio.REJEITADO, r.Status);
    }
}
