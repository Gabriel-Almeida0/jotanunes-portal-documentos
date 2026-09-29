using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.UsuariosInternos;

namespace Jotanunes.Docs.Application.Portas;

/// <summary>
/// Usuário da área Jotanunes identificado pelo token: do Fluig ou do login próprio (research R17). As claims
/// <c>sub</c>/<c>name</c>/<c>email</c>/<c>roles</c> são as mesmas nas duas origens.
/// </summary>
public interface IUsuarioFluigAtual
{
    string Login { get; }
    string Nome { get; }
    string Email { get; }

    /// <summary>
    /// Perfil administrador: o token traz a claim <c>roles</c> com <c>admin</c> (contracts/fluig-identity.md).
    /// Qualquer outro caso é usuário comum. A autorização das operações de administrador é feita na Api.
    /// </summary>
    bool EhAdmin { get; }

    /// <summary>Sessão aberta pelo login próprio (token <c>iss = jotanunes-docs</c>), não pelo Fluig.</summary>
    bool EhLoginLocal { get; }

    /// <summary>Id do usuário interno (claim <c>uid</c>) numa sessão de login próprio; null para o Fluig.</summary>
    Guid? UsuarioInternoId { get; }
}

/// <summary>Empresa autenticada no portal. O id vem SEMPRE do token, nunca do cliente.</summary>
public interface IEmpresaPortalAtual
{
    Guid EmpresaId { get; }
    string Cnpj { get; }
    bool TrocaSenhaPendente { get; }
}

public interface IContextoRequisicao
{
    string? Ip { get; }
}

public interface IHasherSenha
{
    string Gerar(string senha);

    bool Verificar(string senha, string hash);

    /// <summary>Executa uma verificação fictícia para igualar o tempo de resposta (CNPJ inexistente).</summary>
    void VerificarFicticio(string senha);
}

public interface IGeradorSegredos
{
    /// <summary>Token de convite (32 bytes em base64url) e seu hash SHA-256 hex.</summary>
    (string Token, string Hash) GerarTokenConvite();

    string CalcularHashToken(string token);

    /// <summary>Senha temporária de 12 caracteres sem ambíguos, com letra e número.</summary>
    string GerarSenhaTemporaria();
}

public sealed record TokenPortal(string AccessToken, DateTimeOffset ExpiraEm);

public interface IEmissorTokenPortal
{
    TokenPortal Emitir(Empresa empresa);
}

public sealed record TokenJotanunes(string AccessToken, DateTimeOffset ExpiraEm);

/// <summary>Emite o token do login próprio da área Jotanunes (HS256, <c>iss = jotanunes-docs</c>, 8 h; research R17).</summary>
public interface IEmissorTokenJotanunes
{
    TokenJotanunes Emitir(UsuarioInterno usuario);
}

public sealed record MensagemEmail(string Para, string Assunto, string Html, string Texto);

/// <summary>O provedor de e-mail recusou ou não respondeu.</summary>
public sealed class FalhaEnvioEmail(string mensagem, Exception? interna = null) : Exception(mensagem, interna);

public interface IEnviadorEmail
{
    /// <exception cref="FalhaEnvioEmail">quando o envio falha.</exception>
    Task EnviarAsync(MensagemEmail mensagem, CancellationToken ct = default);
}

public interface IArmazenamentoArquivos
{
    Task SalvarAsync(string chave, Stream conteudo, CancellationToken ct = default);

    Task<Stream> AbrirLeituraAsync(string chave, CancellationToken ct = default);

    Task ExcluirAsync(string chave, CancellationToken ct = default);
}

public interface IDetectorFormato
{
    /// <summary>Content type detectado pela assinatura de bytes (PDF, PNG, JPEG) ou null.</summary>
    string? Detectar(ReadOnlySpan<byte> inicio);

    /// <summary>
    /// Checagem estrutural mínima do arquivo inteiro já detectado (fim de arquivo presente: PDF com <c>%%EOF</c>,
    /// PNG com o chunk <c>IEND</c>, JPEG com <c>FF D9</c>). False indica arquivo truncado/corrompido.
    /// </summary>
    bool EstaIntegro(string formato, ReadOnlySpan<byte> conteudo);
}

public interface IRegistroAuditoria
{
    /// <summary>
    /// Registra na mesma unidade de trabalho do caso de uso (gravado no próximo SalvarAsync). O adaptador grava
    /// <c>LOCAL</c> quando o caso de uso passa <c>FLUIG</c> numa sessão de login próprio, e preenche <c>ator_admin</c>
    /// (FLUIG/LOCAL) com o perfil da sessão — ou com <paramref name="atorAdmin"/>, quando informado (ex.: login
    /// bem-sucedido, que ainda não tem sessão).
    /// </summary>
    void Registrar(string atorTipo, string? atorId, string acao, string? recursoTipo = null, string? recursoId = null, bool? atorAdmin = null);
}

/// <summary>Configuração do portal usada nos e-mails.</summary>
public sealed class ConfiguracaoPortal
{
    public string BaseUrl { get; set; } = "http://localhost:5174";
}

/// <summary>Endereço da área Jotanunes (<c>fluig-app</c>) usado nos e-mails de acesso (seção FluigApp).</summary>
public sealed class ConfiguracaoAreaJotanunes
{
    public string BaseUrl { get; set; } = "http://localhost:5173";
}

/// <summary>Login próprio da área Jotanunes (seção Auth:LoginLocal; research R17).</summary>
public sealed class OpcoesLoginLocal
{
    public const string Emissor = "jotanunes-docs";
    public const string Audiencia = "jotanunes-docs-api";
    public static readonly TimeSpan Validade = TimeSpan.FromHours(8);

    /// <summary>Desligado: login/troca de senha/sair → 404 e tokens do login próprio → 401.</summary>
    public bool Habilitado { get; set; } = true;

    /// <summary>Segredo HS256 próprio (≥ 32 bytes, diferente dos segredos do Fluig e do portal).</summary>
    public string Secret { get; set; } = string.Empty;
}
