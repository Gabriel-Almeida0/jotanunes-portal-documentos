using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Convites;

namespace Jotanunes.Docs.Domain.Empresas;

public sealed class Empresa
{
    public const int MaximoFalhasLogin = 5;
    public static readonly TimeSpan DuracaoBloqueio = TimeSpan.FromMinutes(15);

    private Empresa() { }

    public Guid Id { get; private set; }
    public string RazaoSocial { get; private set; } = string.Empty;
    public string? NomeFantasia { get; private set; }
    public string Cnpj { get; private set; } = string.Empty;
    public string EmailContato { get; private set; } = string.Empty;
    public string? NomeContato { get; private set; }
    public string? Telefone { get; private set; }
    public bool Ativa { get; private set; }

    public string? SenhaHash { get; private set; }
    public bool TrocaSenhaObrigatoria { get; private set; }
    public DateTimeOffset? SenhaTemporariaExpiraEm { get; private set; }
    public int VersaoCredencial { get; private set; }
    public int TentativasFalhas { get; private set; }
    public DateTimeOffset? BloqueadoAte { get; private set; }
    public DateTimeOffset? UltimoAcessoEm { get; private set; }

    public DateTimeOffset CriadoEm { get; private set; }
    public string CriadoPorLogin { get; private set; } = string.Empty;
    public DateTimeOffset? AtualizadoEm { get; private set; }
    public string? AtualizadoPorLogin { get; private set; }

    /// <summary>Já recebeu ao menos um convite (a senha só existe depois do 1º convite).</summary>
    public bool JaConvidada => SenhaHash is not null;

    public static Empresa Criar(string? razaoSocial, string? nomeFantasia, string? cnpj, string? emailContato,
        string? nomeContato, string? telefone, string autorLogin, DateTimeOffset agora)
    {
        var e = new Empresa { Id = Guid.NewGuid(), Ativa = true, CriadoEm = agora, CriadoPorLogin = autorLogin };
        var d = Validar(razaoSocial, nomeFantasia, cnpj, emailContato, nomeContato, telefone);
        e.Aplicar(d);
        return e;
    }

    public void Atualizar(string? razaoSocial, string? nomeFantasia, string? cnpj, string? emailContato,
        string? nomeContato, string? telefone, bool ativa, bool jaConvidada, string autorLogin, DateTimeOffset agora)
    {
        var d = Validar(razaoSocial, nomeFantasia, cnpj, emailContato, nomeContato, telefone);
        if (jaConvidada && d.Cnpj != Cnpj)
        {
            throw new ErroDominio(TipoErroDominio.CnpjImutavel, "O CNPJ não pode ser alterado depois do convite.");
        }
        Aplicar(d);
        if (ativa) Ativar(autorLogin, agora);
        else Desativar(autorLogin, agora);
        AtualizadoEm = agora;
        AtualizadoPorLogin = autorLogin;
    }

    public void Ativar(string autorLogin, DateTimeOffset agora)
    {
        if (Ativa) return;
        Ativa = true;
        AtualizadoEm = agora;
        AtualizadoPorLogin = autorLogin;
    }

    /// <summary>Desativa e revoga as sessões do portal (incrementa a versão da credencial).</summary>
    public void Desativar(string autorLogin, DateTimeOffset agora)
    {
        if (!Ativa) return;
        Ativa = false;
        VersaoCredencial++;
        AtualizadoEm = agora;
        AtualizadoPorLogin = autorLogin;
    }

    /// <summary>Novo convite: senha temporária, troca obrigatória, validade de 7 dias e revogação de sessões.</summary>
    public void RegistrarConvite(string senhaTemporariaHash, DateTimeOffset agora)
    {
        SenhaHash = senhaTemporariaHash;
        TrocaSenhaObrigatoria = true;
        SenhaTemporariaExpiraEm = agora + Convite.Validade;
        VersaoCredencial++;
        TentativasFalhas = 0;
        BloqueadoAte = null;
    }

    public void TrocarSenha(string novaSenhaHash, DateTimeOffset agora)
    {
        SenhaHash = novaSenhaHash;
        TrocaSenhaObrigatoria = false;
        SenhaTemporariaExpiraEm = null;
        VersaoCredencial++;
        TentativasFalhas = 0;
        BloqueadoAte = null;
        AtualizadoEm = agora;
    }

    public bool EstaBloqueada(DateTimeOffset agora) => BloqueadoAte is { } ate && ate > agora;

    public bool SenhaTemporariaExpirada(DateTimeOffset agora) =>
        TrocaSenhaObrigatoria && SenhaTemporariaExpiraEm is { } expira && expira <= agora;

    /// <summary>Registra uma falha de senha. Devolve true quando esta falha causou o bloqueio.</summary>
    public bool RegistrarFalhaLogin(DateTimeOffset agora)
    {
        TentativasFalhas++;
        if (TentativasFalhas < MaximoFalhasLogin) return false;
        TentativasFalhas = 0;
        BloqueadoAte = agora + DuracaoBloqueio;
        return true;
    }

    public void RegistrarLoginSucesso(DateTimeOffset agora)
    {
        TentativasFalhas = 0;
        BloqueadoAte = null;
        UltimoAcessoEm = agora;
    }

    public SituacaoAcesso ObterSituacaoAcesso(DateTimeOffset agora)
    {
        if (!Ativa) return SituacaoAcesso.DESATIVADA;
        if (!JaConvidada) return SituacaoAcesso.NAO_CONVIDADA;
        if (!TrocaSenhaObrigatoria) return SituacaoAcesso.ATIVA;
        return SenhaTemporariaExpirada(agora) ? SituacaoAcesso.CONVITE_EXPIRADO : SituacaoAcesso.CONVIDADA;
    }

    private void Aplicar(DadosCadastrais d)
    {
        RazaoSocial = d.RazaoSocial;
        NomeFantasia = d.NomeFantasia;
        Cnpj = d.Cnpj;
        EmailContato = d.Email;
        NomeContato = d.NomeContato;
        Telefone = d.Telefone;
    }

    private sealed record DadosCadastrais(string RazaoSocial, string? NomeFantasia, string Cnpj, string Email,
        string? NomeContato, string? Telefone);

    private static DadosCadastrais Validar(string? razaoSocial, string? nomeFantasia, string? cnpj, string? emailContato,
        string? nomeContato, string? telefone)
    {
        var v = new Validacao();
        var razao = v.TextoObrigatorio("razaoSocial", razaoSocial, 2, 200, "a razão social");
        var fantasia = v.TextoOpcional("nomeFantasia", nomeFantasia, 200, "o nome fantasia");
        if (!Empresas.Cnpj.TryCriar(cnpj, out var c)) v.Erro("cnpj", Empresas.Cnpj.MensagemInvalido);
        if (!Email.TryCriar(emailContato, out var email)) v.Erro("emailContato", "Informe um e-mail válido.");
        var contato = v.TextoOpcional("nomeContato", nomeContato, 150, "o nome do contato");
        string? fone = null;
        if (!string.IsNullOrWhiteSpace(telefone))
        {
            fone = new string(telefone.Where(char.IsAsciiDigit).ToArray());
            if (fone.Length is < 10 or > 11 || telefone.Length > 20)
            {
                v.Erro("telefone", "O telefone deve ter 10 ou 11 dígitos.");
            }
        }
        v.LancarSeHouver();
        return new DadosCadastrais(razao!, fantasia, c!.Valor, email!.Valor, contato, fone);
    }
}
