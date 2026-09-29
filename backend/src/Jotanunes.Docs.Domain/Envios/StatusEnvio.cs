namespace Jotanunes.Docs.Domain.Envios;

public enum StatusEnvio
{
    EM_ANALISE,
    APROVADO,
    REJEITADO,
}

/// <summary>Situação de um documento (empresa × tipo), derivada dos envios.</summary>
public enum SituacaoDocumento
{
    PENDENTE_ENVIO,
    EM_ANALISE,
    APROVADO,
    REJEITADO,
}
