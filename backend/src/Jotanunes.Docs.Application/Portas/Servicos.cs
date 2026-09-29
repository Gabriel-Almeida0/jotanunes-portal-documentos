using Jotanunes.Docs.Domain.Empresas;

namespace Jotanunes.Docs.Application.Portas;

/// <summary>Usuário Fluig identificado pelo token (esquema Fluig).</summary>
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
    /// <summary>Registra na mesma unidade de trabalho do caso de uso (gravado no próximo SalvarAsync).</summary>
    void Registrar(string atorTipo, string? atorId, string acao, string? recursoTipo = null, string? recursoId = null);
}

/// <summary>Configuração do portal usada nos e-mails.</summary>
public sealed class ConfiguracaoPortal
{
    public string BaseUrl { get; set; } = "http://localhost:5174";
}
