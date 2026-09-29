namespace Jotanunes.Docs.Domain.Auditoria;

public static class AtorAuditoria
{
    public const string Fluig = "FLUIG";
    public const string Empresa = "EMPRESA";
    public const string Anonimo = "ANONIMO";
}

public static class AcaoAuditoria
{
    public const string LoginSucesso = "LOGIN_SUCESSO";
    public const string LoginFalha = "LOGIN_FALHA";
    public const string LoginBloqueado = "LOGIN_BLOQUEADO";
    public const string SenhaTrocada = "SENHA_TROCADA";
    public const string ConviteEnviado = "CONVITE_ENVIADO";
    public const string DocumentoEnviado = "DOCUMENTO_ENVIADO";
    public const string ArquivoBaixado = "ARQUIVO_BAIXADO";
    public const string EnvioAprovado = "ENVIO_APROVADO";
    public const string EnvioRejeitado = "ENVIO_REJEITADO";
    /// <summary>Usuário Fluig comum chamou uma operação de administrador (recurso OPERACAO + operationId).</summary>
    public const string PermissaoNegada = "PERMISSAO_NEGADA";
}

/// <summary>Linha da trilha de auditoria. Nunca contém senha, token ou conteúdo de arquivo.</summary>
public sealed class RegistroAuditoria
{
    private RegistroAuditoria() { }

    /// <param name="atorAdmin">Perfil do usuário Fluig (true = administrador). Ignorado (fica null) se o ator não for FLUIG.</param>
    public RegistroAuditoria(DateTimeOffset ocorridoEm, string atorTipo, string? atorId, string acao,
        string? recursoTipo, string? recursoId, string? ip, bool? atorAdmin = null)
    {
        OcorridoEm = ocorridoEm;
        AtorTipo = atorTipo;
        AtorId = atorId;
        AtorAdmin = atorTipo == AtorAuditoria.Fluig ? atorAdmin : null;
        Acao = acao;
        RecursoTipo = recursoTipo;
        RecursoId = recursoId;
        Ip = ip;
    }

    public long Id { get; private set; }
    public DateTimeOffset OcorridoEm { get; private set; }
    public string AtorTipo { get; private set; } = string.Empty;
    public string? AtorId { get; private set; }
    /// <summary>Só para ator FLUIG: se o token tinha o papel admin. Null para EMPRESA/ANONIMO e linhas antigas.</summary>
    public bool? AtorAdmin { get; private set; }
    public string Acao { get; private set; } = string.Empty;
    public string? RecursoTipo { get; private set; }
    public string? RecursoId { get; private set; }
    public string? Ip { get; private set; }
}
