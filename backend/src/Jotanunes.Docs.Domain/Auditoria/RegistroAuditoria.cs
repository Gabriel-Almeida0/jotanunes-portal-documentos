namespace Jotanunes.Docs.Domain.Auditoria;

public static class AtorAuditoria
{
    public const string Fluig = "FLUIG";
    public const string Empresa = "EMPRESA";
    public const string Anonimo = "ANONIMO";
    /// <summary>Usuário interno do login próprio da área Jotanunes (data-model §7, §10).</summary>
    public const string Local = "LOCAL";
    /// <summary>Comando de instalação (<c>criar-admin</c>); <c>ator_id = sistema</c>.</summary>
    public const string Sistema = "SISTEMA";

    /// <summary>Atores com perfil (coluna <c>ator_admin</c>): usuário do Fluig e usuário interno.</summary>
    public static bool TemPerfil(string atorTipo) => atorTipo is Fluig or Local;
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
    public const string UsuarioCriado = "USUARIO_CRIADO";
    /// <summary>Nome, e-mail ou papel do usuário interno alterados.</summary>
    public const string UsuarioAtualizado = "USUARIO_ATUALIZADO";
    public const string UsuarioDesativado = "USUARIO_DESATIVADO";
    public const string UsuarioReativado = "USUARIO_REATIVADO";
    public const string SenhaRedefinida = "SENHA_REDEFINIDA";
    /// <summary>Usuário interno saiu (versão da credencial + 1).</summary>
    public const string SessaoEncerrada = "SESSAO_ENCERRADA";
    /// <summary>Abrangência do tipo de documento trocada (GERAL ↔ POR_OBRA).</summary>
    public const string TipoAbrangenciaAlterada = "TIPO_ABRANGENCIA_ALTERADA";
    /// <summary>Tipo POR_OBRA passou a ser exigido na obra (recurso OBRA, id <c>{obraId:N}:{tipoId:N}</c>).</summary>
    public const string ObraTipoMarcado = "OBRA_TIPO_MARCADO";
    public const string ObraTipoDesmarcado = "OBRA_TIPO_DESMARCADO";
    /// <summary>Vínculo obra–empresa encerrado (recurso VINCULO, id <c>{obraId:N}:{empresaId:N}</c>).</summary>
    public const string VinculoEncerrado = "VINCULO_ENCERRADO";
    public const string VinculoReaberto = "VINCULO_REABERTO";
    /// <summary>Periodicidade (unidade, intervalo ou prazo) do tipo de documento alterada (003).</summary>
    public const string TipoPeriodicidadeAlterada = "TIPO_PERIODICIDADE_ALTERADA";
}

public static class RecursoAuditoria
{
    public const string UsuarioInterno = "USUARIO_INTERNO";
    public const string TipoDocumento = "TIPO_DOCUMENTO";
    public const string Obra = "OBRA";
    public const string Vinculo = "VINCULO";

    /// <summary>Id composto <c>{a:N}:{b:N}</c> (marcação de tipo na obra, vínculo obra–empresa).</summary>
    public static string IdComposto(Guid a, Guid b) => $"{a:N}:{b:N}";
}

/// <summary>Linha da trilha de auditoria. Nunca contém senha, token ou conteúdo de arquivo.</summary>
public sealed class RegistroAuditoria
{
    private RegistroAuditoria() { }

    /// <param name="atorAdmin">Perfil do usuário (true = administrador). Ignorado (fica null) se o ator não for FLUIG nem LOCAL.</param>
    public RegistroAuditoria(DateTimeOffset ocorridoEm, string atorTipo, string? atorId, string acao,
        string? recursoTipo, string? recursoId, string? ip, bool? atorAdmin = null)
    {
        OcorridoEm = ocorridoEm;
        AtorTipo = atorTipo;
        AtorId = atorId;
        AtorAdmin = AtorAuditoria.TemPerfil(atorTipo) ? atorAdmin : null;
        Acao = acao;
        RecursoTipo = recursoTipo;
        RecursoId = recursoId;
        Ip = ip;
    }

    public long Id { get; private set; }
    public DateTimeOffset OcorridoEm { get; private set; }
    public string AtorTipo { get; private set; } = string.Empty;
    public string? AtorId { get; private set; }
    /// <summary>Só para ator FLUIG ou LOCAL: se a sessão tinha o papel admin. Null para EMPRESA/ANONIMO/SISTEMA e linhas antigas.</summary>
    public bool? AtorAdmin { get; private set; }
    public string Acao { get; private set; } = string.Empty;
    public string? RecursoTipo { get; private set; }
    public string? RecursoId { get; private set; }
    public string? Ip { get; private set; }
}
