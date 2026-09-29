namespace Jotanunes.Docs.Domain.Empresas;

/// <summary>Situação de acesso ao portal (derivada, não persistida). Ver data-model §2.</summary>
public enum SituacaoAcesso
{
    NAO_CONVIDADA,
    CONVIDADA,
    CONVITE_EXPIRADO,
    ATIVA,
    DESATIVADA,
}
