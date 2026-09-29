using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Empresas;

namespace Jotanunes.Docs.Domain.UsuariosInternos;

/// <summary>
/// Colaborador da Jotanunes que entra na área Jotanunes com login + senha (data-model §10, research R17).
/// <see cref="VersaoCredencial"/> (claim <c>ver</c>) sobe ao desativar, reativar, redefinir/trocar a senha, mudar o
/// papel e sair: os tokens anteriores deixam de valer na hora. Nunca é excluído.
/// </summary>
public sealed class UsuarioInterno
{
    /// <summary>Validade da senha provisória (cadastro, redefinição e comando de instalação).</summary>
    public static readonly TimeSpan ValidadeSenhaProvisoria = TimeSpan.FromDays(7);

    private UsuarioInterno() { }

    public Guid Id { get; private set; }
    public string Login { get; private set; } = string.Empty;
    public string Nome { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public bool Admin { get; private set; }
    public bool Ativo { get; private set; }

    public string SenhaHash { get; private set; } = string.Empty;
    public bool TrocaSenhaObrigatoria { get; private set; }
    public DateTimeOffset? SenhaProvisoriaExpiraEm { get; private set; }
    public int VersaoCredencial { get; private set; }
    public int TentativasFalhas { get; private set; }
    public DateTimeOffset? BloqueadoAte { get; private set; }
    public DateTimeOffset? UltimoAcessoEm { get; private set; }

    public DateTimeOffset CriadoEm { get; private set; }
    public string CriadoPorLogin { get; private set; } = string.Empty;
    public DateTimeOffset? AtualizadoEm { get; private set; }
    public string? AtualizadoPorLogin { get; private set; }

    /// <summary>Usuário ativo com o papel de administrador (conta para a regra do último administrador).</summary>
    public bool EhAdministradorAtivo => Admin && Ativo;

    /// <summary>Novo usuário com senha provisória (+7 dias) e troca obrigatória no primeiro acesso.</summary>
    public static UsuarioInterno Criar(string? login, string? nome, string? email, bool admin, string senhaProvisoriaHash,
        string autorLogin, DateTimeOffset agora)
    {
        var v = new Validacao();
        if (!LoginUsuario.TryCriar(login, out var l))
        {
            v.Erro("login", string.IsNullOrWhiteSpace(login) ? "Informe o login." : LoginUsuario.MensagemInvalido);
        }
        var (n, e) = ValidarDados(v, nome, email);
        v.LancarSeHouver();

        var u = new UsuarioInterno
        {
            Id = Guid.NewGuid(),
            Login = l!.Valor,
            Nome = n!,
            Email = e!,
            Admin = admin,
            Ativo = true,
            CriadoEm = agora,
            CriadoPorLogin = autorLogin,
        };
        u.DefinirSenhaProvisoria(senhaProvisoriaHash, agora);
        return u;
    }

    /// <summary>Muda nome e e-mail. Não revoga sessões (o nome novo aparece no próximo login).</summary>
    public void AtualizarDados(string? nome, string? email, string autorLogin, DateTimeOffset agora)
    {
        var v = new Validacao();
        var (n, e) = ValidarDados(v, nome, email);
        v.LancarSeHouver();
        if (n == Nome && e == Email) return;
        Nome = n!;
        Email = e!;
        Tocar(autorLogin, agora);
    }

    /// <summary>Dá ou tira o papel de administrador; mudança revoga as sessões.</summary>
    public void DefinirAdmin(bool admin, string autorLogin, DateTimeOffset agora)
    {
        if (Admin == admin) return;
        Admin = admin;
        VersaoCredencial++;
        Tocar(autorLogin, agora);
    }

    public void Desativar(string autorLogin, DateTimeOffset agora)
    {
        if (!Ativo) return;
        Ativo = false;
        VersaoCredencial++;
        Tocar(autorLogin, agora);
    }

    public void Reativar(string autorLogin, DateTimeOffset agora)
    {
        if (Ativo) return;
        Ativo = true;
        VersaoCredencial++;
        Tocar(autorLogin, agora);
    }

    /// <summary>
    /// Troca feita pelo próprio usuário (a senha atual já foi conferida pelo caso de uso). Segue a
    /// <see cref="PoliticaSenha"/> (<see cref="TipoErroDominio.SenhaFraca"/>).
    /// </summary>
    public void TrocarSenha(string? novaSenha, string? senhaAtual, Func<string, string> gerarHash, DateTimeOffset agora)
    {
        PoliticaSenha.Validar(novaSenha, senhaAtual);
        SenhaHash = gerarHash(novaSenha!);
        TrocaSenhaObrigatoria = false;
        SenhaProvisoriaExpiraEm = null;
        TentativasFalhas = 0;
        BloqueadoAte = null;
        VersaoCredencial++;
        AtualizadoEm = agora;
    }

    /// <summary>Nova senha provisória gerada por um administrador: troca obrigatória, +7 dias, desbloqueia e revoga sessões.</summary>
    public void RedefinirSenha(string senhaProvisoriaHash, string autorLogin, DateTimeOffset agora)
    {
        DefinirSenhaProvisoria(senhaProvisoriaHash, agora);
        VersaoCredencial++;
        Tocar(autorLogin, agora);
    }

    /// <summary>
    /// Comando de instalação com <c>--forcar</c> sobre um login existente: vira administrador ativo com nome/e-mail
    /// informados e nova senha provisória; a versão sobe uma vez (tokens anteriores deixam de valer).
    /// </summary>
    public void PromoverAdministradorInicial(string? nome, string? email, string senhaProvisoriaHash, string autorLogin, DateTimeOffset agora)
    {
        var v = new Validacao();
        var (n, e) = ValidarDados(v, nome, email);
        v.LancarSeHouver();
        Nome = n!;
        Email = e!;
        Admin = true;
        Ativo = true;
        DefinirSenhaProvisoria(senhaProvisoriaHash, agora);
        VersaoCredencial++;
        Tocar(autorLogin, agora);
    }

    /// <summary>Sair: revoga as sessões do usuário (todas, inclusive de outras abas/computadores).</summary>
    public void EncerrarSessoes() => VersaoCredencial++;

    public bool EstaBloqueado(DateTimeOffset agora) => BloqueadoAte is { } ate && ate > agora;

    public bool SenhaProvisoriaExpirada(DateTimeOffset agora) =>
        TrocaSenhaObrigatoria && SenhaProvisoriaExpiraEm is { } expira && expira <= agora;

    /// <summary>Registra uma falha de senha. Devolve true quando esta falha causou o bloqueio (regra de <see cref="Empresa"/>).</summary>
    public bool RegistrarFalhaLogin(DateTimeOffset agora)
    {
        TentativasFalhas++;
        if (TentativasFalhas < Empresa.MaximoFalhasLogin) return false;
        TentativasFalhas = 0;
        BloqueadoAte = agora + Empresa.DuracaoBloqueio;
        return true;
    }

    public void RegistrarLoginSucesso(DateTimeOffset agora)
    {
        TentativasFalhas = 0;
        BloqueadoAte = null;
        UltimoAcessoEm = agora;
    }

    public SituacaoUsuarioInterno Situacao(DateTimeOffset agora)
    {
        if (!Ativo) return SituacaoUsuarioInterno.DESATIVADO;
        if (!TrocaSenhaObrigatoria) return SituacaoUsuarioInterno.ATIVO;
        return SenhaProvisoriaExpirada(agora) ? SituacaoUsuarioInterno.SENHA_PROVISORIA_EXPIRADA : SituacaoUsuarioInterno.AGUARDANDO_PRIMEIRO_ACESSO;
    }

    private void DefinirSenhaProvisoria(string hash, DateTimeOffset agora)
    {
        if (string.IsNullOrWhiteSpace(hash)) throw new ArgumentException("Hash da senha obrigatório.", nameof(hash));
        SenhaHash = hash;
        TrocaSenhaObrigatoria = true;
        SenhaProvisoriaExpiraEm = agora + ValidadeSenhaProvisoria;
        TentativasFalhas = 0;
        BloqueadoAte = null;
    }

    private void Tocar(string autorLogin, DateTimeOffset agora)
    {
        AtualizadoEm = agora;
        AtualizadoPorLogin = autorLogin;
    }

    private static (string? Nome, string? Email) ValidarDados(Validacao v, string? nome, string? email)
    {
        var n = v.TextoObrigatorio("nome", nome, 3, 150, "o nome");
        string? e = null;
        if (Comum.Email.TryCriar(email, out var em)) e = em!.Valor;
        else v.Erro("email", "Informe um e-mail válido.");
        return (n, e);
    }
}
