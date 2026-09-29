using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.UsuariosInternos;

namespace Jotanunes.Docs.Domain.Tests.UsuariosInternos;

/// <summary>Usuário interno do login próprio da área Jotanunes (data-model §10; FR-102–FR-106, FR-109).</summary>
public class UsuarioInternoTests
{
    private static readonly DateTimeOffset Agora = new(2026, 9, 29, 15, 0, 0, TimeSpan.Zero);

    private static string Hash(string senha) => "hash:" + senha;

    private static UsuarioInterno Novo(bool admin = false) =>
        UsuarioInterno.Criar("ana.souza", "Ana Souza", "ana@jotanunes.com", admin, Hash("Provisoria1"), "admin.x", Agora);

    [Theory]
    [InlineData(" Ana.Souza ", "ana.souza")]
    [InlineData("JOAO_1", "joao_1")]
    [InlineData("a-b", "a-b")]
    public void Login_normalizado_com_trim_e_minusculas(string entrada, string esperado)
    {
        Assert.True(LoginUsuario.TryCriar(entrada, out var login));
        Assert.Equal(esperado, login!.Valor);
        Assert.Equal(esperado, LoginUsuario.Normalizar(entrada));
    }

    public static TheoryData<string?> LoginsInvalidos => new()
    {
        null, "", "   ", "joão", "ana souza", "ab", new string('a', 101), "ana@souza", "ana/souza",
    };

    [Theory]
    [MemberData(nameof(LoginsInvalidos))]
    public void Login_fora_do_formato_e_recusado(string? entrada)
    {
        Assert.False(LoginUsuario.TryCriar(entrada, out _));
        var erro = Assert.Throws<ErroDominio>(() =>
            UsuarioInterno.Criar(entrada, "Ana Souza", "ana@jotanunes.com", false, "h", "x", Agora));
        Assert.Equal(TipoErroDominio.Validacao, erro.Tipo);
        Assert.Contains("login", erro.Erros.Keys);
    }

    [Fact]
    public void Login_com_100_caracteres_e_aceito()
    {
        Assert.True(LoginUsuario.TryCriar(new string('a', 100), out _));
        Assert.True(LoginUsuario.TryCriar("abc", out _));
    }

    [Theory]
    [InlineData("Al")]
    [InlineData("  ")]
    [InlineData(null)]
    public void Nome_precisa_de_3_a_150(string? nome)
    {
        var erro = Assert.Throws<ErroDominio>(() => UsuarioInterno.Criar("ana", nome, "ana@jotanunes.com", false, "h", "x", Agora));
        Assert.Contains("nome", erro.Erros.Keys);
        Assert.Throws<ErroDominio>(() => UsuarioInterno.Criar("ana", new string('n', 151), "ana@jotanunes.com", false, "h", "x", Agora));
        Assert.Equal(new string('n', 150), UsuarioInterno.Criar("ana", new string('n', 150), "a@b.com", false, "h", "x", Agora).Nome);
    }

    [Theory]
    [InlineData("sem-arroba")]
    [InlineData("")]
    [InlineData(null)]
    public void Email_precisa_ser_valido(string? email)
    {
        var erro = Assert.Throws<ErroDominio>(() => UsuarioInterno.Criar("ana", "Ana Souza", email, false, "h", "x", Agora));
        Assert.Contains("email", erro.Erros.Keys);
        var longo = new string('e', 250) + "@b.com";
        Assert.Contains("email", Assert.Throws<ErroDominio>(() => UsuarioInterno.Criar("ana", "Ana Souza", longo, false, "h", "x", Agora)).Erros.Keys);
    }

    [Fact]
    public void Criar_define_provisoria_troca_obrigatoria_e_versao_zero()
    {
        var u = UsuarioInterno.Criar(" Ana.Souza ", "  Ana Souza ", " Ana@Jotanunes.COM ", true, Hash("P1"), "admin.x", Agora);
        Assert.NotEqual(Guid.Empty, u.Id);
        Assert.Equal("ana.souza", u.Login);
        Assert.Equal("Ana Souza", u.Nome);
        Assert.Equal("ana@jotanunes.com", u.Email);
        Assert.True(u.Admin);
        Assert.True(u.Ativo);
        Assert.True(u.TrocaSenhaObrigatoria);
        Assert.Equal(Agora.AddDays(7), u.SenhaProvisoriaExpiraEm);
        Assert.Equal(0, u.VersaoCredencial);
        Assert.Equal(0, u.TentativasFalhas);
        Assert.Null(u.BloqueadoAte);
        Assert.Equal(Hash("P1"), u.SenhaHash);
        Assert.Equal("admin.x", u.CriadoPorLogin);
        Assert.Equal(Agora, u.CriadoEm);
        Assert.False(Novo(admin: false).Admin);
    }

    [Fact]
    public void TrocarSenha_segue_politica_zera_expiracao_e_incrementa_versao()
    {
        var u = Novo();
        Assert.Equal(TipoErroDominio.SenhaFraca,
            Assert.Throws<ErroDominio>(() => u.TrocarSenha("fraca", "Provisoria1", Hash, Agora)).Tipo);
        Assert.Equal(TipoErroDominio.SenhaFraca,
            Assert.Throws<ErroDominio>(() => u.TrocarSenha("Provisoria1", "Provisoria1", Hash, Agora)).Tipo);
        Assert.Equal(0, u.VersaoCredencial);

        u.TrocarSenha("NovaSenha42", "Provisoria1", Hash, Agora.AddHours(1));
        Assert.Equal(Hash("NovaSenha42"), u.SenhaHash);
        Assert.False(u.TrocaSenhaObrigatoria);
        Assert.Null(u.SenhaProvisoriaExpiraEm);
        Assert.Equal(1, u.VersaoCredencial);
    }

    [Fact]
    public void Quinta_falha_bloqueia_15_minutos_e_sucesso_zera()
    {
        var u = Novo();
        for (var i = 1; i <= 4; i++) Assert.False(u.RegistrarFalhaLogin(Agora));
        Assert.False(u.EstaBloqueado(Agora));
        Assert.True(u.RegistrarFalhaLogin(Agora));
        Assert.Equal(Agora.AddMinutes(15), u.BloqueadoAte);
        Assert.True(u.EstaBloqueado(Agora.AddMinutes(14)));
        Assert.False(u.EstaBloqueado(Agora.AddMinutes(15)));

        u.RegistrarFalhaLogin(Agora.AddMinutes(20));
        Assert.Equal(1, u.TentativasFalhas);
        u.RegistrarLoginSucesso(Agora.AddMinutes(21));
        Assert.Equal(0, u.TentativasFalhas);
        Assert.Null(u.BloqueadoAte);
        Assert.Equal(Agora.AddMinutes(21), u.UltimoAcessoEm);
    }

    [Fact]
    public void RedefinirSenha_gera_nova_provisoria_zera_bloqueio_e_incrementa_versao()
    {
        var u = Novo();
        u.TrocarSenha("NovaSenha42", "Provisoria1", Hash, Agora);
        for (var i = 0; i < 5; i++) u.RegistrarFalhaLogin(Agora);
        Assert.True(u.EstaBloqueado(Agora));
        var versao = u.VersaoCredencial;

        u.RedefinirSenha(Hash("Outra1234"), "admin.y", Agora.AddDays(1));
        Assert.Equal(Hash("Outra1234"), u.SenhaHash);
        Assert.True(u.TrocaSenhaObrigatoria);
        Assert.Equal(Agora.AddDays(8), u.SenhaProvisoriaExpiraEm);
        Assert.Equal(0, u.TentativasFalhas);
        Assert.Null(u.BloqueadoAte);
        Assert.Equal(versao + 1, u.VersaoCredencial);
        Assert.Equal("admin.y", u.AtualizadoPorLogin);
    }

    [Fact]
    public void Desativar_reativar_e_mudar_papel_incrementam_versao()
    {
        var u = Novo();
        u.Desativar("x", Agora);
        Assert.False(u.Ativo);
        Assert.Equal(1, u.VersaoCredencial);
        u.Desativar("x", Agora); // sem mudança
        Assert.Equal(1, u.VersaoCredencial);
        u.Reativar("x", Agora);
        Assert.True(u.Ativo);
        Assert.Equal(2, u.VersaoCredencial);
        u.DefinirAdmin(true, "x", Agora);
        Assert.True(u.Admin);
        Assert.Equal(3, u.VersaoCredencial);
        u.DefinirAdmin(true, "x", Agora); // mesmo valor
        Assert.Equal(3, u.VersaoCredencial);
        u.DefinirAdmin(false, "x", Agora);
        Assert.Equal(4, u.VersaoCredencial);
        u.EncerrarSessoes();
        Assert.Equal(5, u.VersaoCredencial);
    }

    [Fact]
    public void AtualizarDados_nao_muda_a_versao_e_valida()
    {
        var u = Novo();
        u.AtualizarDados("Ana S. Souza", "Nova@Jotanunes.com", "admin.y", Agora.AddHours(1));
        Assert.Equal("Ana S. Souza", u.Nome);
        Assert.Equal("nova@jotanunes.com", u.Email);
        Assert.Equal(0, u.VersaoCredencial);
        Assert.Equal("admin.y", u.AtualizadoPorLogin);
        Assert.Equal(Agora.AddHours(1), u.AtualizadoEm);
        var erro = Assert.Throws<ErroDominio>(() => u.AtualizarDados("A", "x", "admin.y", Agora));
        Assert.Contains("nome", erro.Erros.Keys);
        Assert.Contains("email", erro.Erros.Keys);
    }

    [Fact]
    public void Situacao_tem_os_quatro_valores()
    {
        var u = Novo();
        Assert.Equal(SituacaoUsuarioInterno.AGUARDANDO_PRIMEIRO_ACESSO, u.Situacao(Agora));
        Assert.Equal(SituacaoUsuarioInterno.AGUARDANDO_PRIMEIRO_ACESSO, u.Situacao(Agora.AddDays(7).AddSeconds(-1)));
        Assert.Equal(SituacaoUsuarioInterno.SENHA_PROVISORIA_EXPIRADA, u.Situacao(Agora.AddDays(7)));
        Assert.True(u.SenhaProvisoriaExpirada(Agora.AddDays(7)));

        u.TrocarSenha("NovaSenha42", "Provisoria1", Hash, Agora);
        Assert.Equal(SituacaoUsuarioInterno.ATIVO, u.Situacao(Agora.AddDays(30)));
        Assert.False(u.SenhaProvisoriaExpirada(Agora.AddDays(30)));

        u.Desativar("x", Agora);
        Assert.Equal(SituacaoUsuarioInterno.DESATIVADO, u.Situacao(Agora));
        Assert.Equal(["AGUARDANDO_PRIMEIRO_ACESSO", "SENHA_PROVISORIA_EXPIRADA", "ATIVO", "DESATIVADO"], Enum.GetNames<SituacaoUsuarioInterno>());
    }

    [Fact]
    public void Promover_administrador_inicial_reativa_redefine_e_incrementa_uma_vez()
    {
        var u = Novo(admin: false);
        u.TrocarSenha("NovaSenha42", "Provisoria1", Hash, Agora);
        u.Desativar("x", Agora);
        var versao = u.VersaoCredencial;

        u.PromoverAdministradorInicial("Ana Nova", "ana.nova@jotanunes.com", Hash("Prov9999"), "sistema", Agora.AddDays(1));
        Assert.True(u.Admin);
        Assert.True(u.Ativo);
        Assert.Equal("Ana Nova", u.Nome);
        Assert.Equal("ana.nova@jotanunes.com", u.Email);
        Assert.True(u.TrocaSenhaObrigatoria);
        Assert.Equal(Agora.AddDays(8), u.SenhaProvisoriaExpiraEm);
        Assert.Equal(versao + 1, u.VersaoCredencial);
        Assert.Equal("sistema", u.AtualizadoPorLogin);
    }
}
