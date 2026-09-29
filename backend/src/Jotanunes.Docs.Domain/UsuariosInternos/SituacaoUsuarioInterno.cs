namespace Jotanunes.Docs.Domain.UsuariosInternos;

/// <summary>Situação derivada do usuário interno (data-model §10; enum <c>SituacaoUsuarioInterno</c> do contrato).</summary>
public enum SituacaoUsuarioInterno
{
    AGUARDANDO_PRIMEIRO_ACESSO,
    SENHA_PROVISORIA_EXPIRADA,
    ATIVO,
    DESATIVADO,
}
