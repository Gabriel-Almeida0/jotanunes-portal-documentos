using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;

namespace Jotanunes.Docs.Domain.Tests;

public class AcessoEmpresaTests
{
    private static readonly DateTimeOffset Agora = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);

    private static Empresa NovaEmpresa() =>
        Empresa.Criar("Alfa", null, "11222333000181", "a@b.com", null, null, "x", Agora);

    [Fact]
    public void RegistrarConvite_define_troca_obrigatoria_expiracao_e_versao()
    {
        var e = NovaEmpresa();
        e.RegistrarConvite("hash1", Agora);
        Assert.Equal("hash1", e.SenhaHash);
        Assert.True(e.TrocaSenhaObrigatoria);
        Assert.Equal(Agora.AddDays(7), e.SenhaTemporariaExpiraEm);
        Assert.Equal(1, e.VersaoCredencial);
        e.RegistrarConvite("hash2", Agora);
        Assert.Equal(2, e.VersaoCredencial);
    }

    [Fact]
    public void RegistrarConvite_zera_bloqueio()
    {
        var e = NovaEmpresa();
        e.RegistrarConvite("h", Agora);
        for (var i = 0; i < 5; i++) e.RegistrarFalhaLogin(Agora);
        Assert.True(e.EstaBloqueada(Agora));
        e.RegistrarConvite("h2", Agora);
        Assert.False(e.EstaBloqueada(Agora));
        Assert.Equal(0, e.TentativasFalhas);
    }

    [Theory]
    [InlineData("curta1")]
    [InlineData("semnumeros")]
    [InlineData("12345678")]
    [InlineData("")]
    [InlineData(null)]
    public void PoliticaSenha_recusa_fracas(string? senha)
    {
        var erro = Assert.Throws<ErroDominio>(() => PoliticaSenha.Validar(senha, "Temp1234abcd"));
        Assert.Equal(TipoErroDominio.SenhaFraca, erro.Tipo);
    }

    [Fact]
    public void PoliticaSenha_recusa_mais_de_128_e_igual_a_atual()
    {
        Assert.Equal(TipoErroDominio.SenhaFraca,
            Assert.Throws<ErroDominio>(() => PoliticaSenha.Validar("a1" + new string('b', 127), "x")).Tipo);
        Assert.Equal(TipoErroDominio.SenhaFraca,
            Assert.Throws<ErroDominio>(() => PoliticaSenha.Validar("Alfa2026ok", "Alfa2026ok")).Tipo);
    }

    [Fact]
    public void PoliticaSenha_aceita_boa()
    {
        PoliticaSenha.Validar("Alfa2026ok", "Temp1234abcd");
        PoliticaSenha.Validar("a1" + new string('b', 126), "x");
    }

    [Fact]
    public void TrocarSenha_zera_expiracao_e_incrementa_versao()
    {
        var e = NovaEmpresa();
        e.RegistrarConvite("h", Agora);
        e.TrocarSenha("novo", Agora.AddHours(1));
        Assert.Equal("novo", e.SenhaHash);
        Assert.False(e.TrocaSenhaObrigatoria);
        Assert.Null(e.SenhaTemporariaExpiraEm);
        Assert.Equal(2, e.VersaoCredencial);
    }

    [Fact]
    public void Quinta_falha_bloqueia_15_minutos_e_sucesso_zera()
    {
        var e = NovaEmpresa();
        e.RegistrarConvite("h", Agora);
        for (var i = 1; i <= 4; i++)
        {
            Assert.False(e.RegistrarFalhaLogin(Agora));
            Assert.False(e.EstaBloqueada(Agora));
        }
        Assert.True(e.RegistrarFalhaLogin(Agora));
        Assert.Equal(Agora.AddMinutes(15), e.BloqueadoAte);
        Assert.True(e.EstaBloqueada(Agora.AddMinutes(14)));
        Assert.False(e.EstaBloqueada(Agora.AddMinutes(15)));

        e.RegistrarFalhaLogin(Agora.AddMinutes(20));
        Assert.Equal(1, e.TentativasFalhas);
        e.RegistrarLoginSucesso(Agora.AddMinutes(21));
        Assert.Equal(0, e.TentativasFalhas);
        Assert.Null(e.BloqueadoAte);
        Assert.Equal(Agora.AddMinutes(21), e.UltimoAcessoEm);
    }

    [Fact]
    public void SituacaoConvite_por_regra()
    {
        var c = Convite.Criar(Guid.NewGuid(), "a@b.com", new string('a', 64), "dev", "Dev", Agora);
        Assert.Equal(Agora.AddDays(7), c.ExpiraEm);
        Assert.Equal(SituacaoConvite.VALIDO, c.Situacao(Agora));
        Assert.Equal(SituacaoConvite.EXPIRADO, c.Situacao(Agora.AddDays(7)));

        var s = Convite.Criar(Guid.NewGuid(), "a@b.com", new string('b', 64), "dev", "Dev", Agora);
        s.MarcarSubstituido(Agora.AddDays(1));
        Assert.Equal(SituacaoConvite.SUBSTITUIDO, s.Situacao(Agora.AddDays(1)));

        var u = Convite.Criar(Guid.NewGuid(), "a@b.com", new string('c', 64), "dev", "Dev", Agora);
        u.MarcarUsado(Agora.AddDays(1));
        Assert.Equal(SituacaoConvite.USADO, u.Situacao(Agora.AddDays(30)));
    }

    [Fact]
    public void SituacaoAcesso_cinco_valores()
    {
        var e = NovaEmpresa();
        Assert.Equal(SituacaoAcesso.NAO_CONVIDADA, e.ObterSituacaoAcesso(Agora));
        e.RegistrarConvite("h", Agora);
        Assert.Equal(SituacaoAcesso.CONVIDADA, e.ObterSituacaoAcesso(Agora.AddDays(6)));
        Assert.Equal(SituacaoAcesso.CONVITE_EXPIRADO, e.ObterSituacaoAcesso(Agora.AddDays(7)));
        e.TrocarSenha("n", Agora.AddDays(1));
        Assert.Equal(SituacaoAcesso.ATIVA, e.ObterSituacaoAcesso(Agora.AddDays(8)));
        e.Desativar("x", Agora);
        Assert.Equal(SituacaoAcesso.DESATIVADA, e.ObterSituacaoAcesso(Agora));
    }

    [Fact]
    public void SenhaTemporariaExpirada()
    {
        var e = NovaEmpresa();
        e.RegistrarConvite("h", Agora);
        Assert.False(e.SenhaTemporariaExpirada(Agora.AddDays(6)));
        Assert.True(e.SenhaTemporariaExpirada(Agora.AddDays(7)));
        e.TrocarSenha("n", Agora);
        Assert.False(e.SenhaTemporariaExpirada(Agora.AddDays(30)));
    }

    [Fact]
    public void Tentativas_por_cnpj_bloqueiam_na_quinta_falha_como_a_empresa()
    {
        var t = new TentativasLoginCnpj(new string('a', 64));
        var e = NovaEmpresa();
        e.RegistrarConvite("hash", Agora);
        for (var i = 1; i <= 4; i++)
        {
            Assert.False(t.RegistrarFalha(Agora));
            Assert.False(e.RegistrarFalhaLogin(Agora));
            Assert.Equal(i, t.TentativasFalhas);
        }
        Assert.True(t.RegistrarFalha(Agora));
        Assert.True(e.RegistrarFalhaLogin(Agora));
        Assert.Equal(e.BloqueadoAte, t.BloqueadoAte);
        Assert.Equal(Agora.AddMinutes(15), t.BloqueadoAte);
        Assert.Equal(0, t.TentativasFalhas);
        Assert.Equal(Agora, t.UltimaFalhaEm);
        Assert.True(t.EstaBloqueada(Agora.AddMinutes(14)));
        Assert.False(t.EstaBloqueada(Agora.AddMinutes(15)));
    }

    [Fact]
    public void Tentativas_por_cnpj_exigem_chave()
    {
        Assert.Throws<ArgumentException>(() => new TentativasLoginCnpj(" "));
        Assert.False(new TentativasLoginCnpj("k").EstaBloqueada(Agora));
    }
}
