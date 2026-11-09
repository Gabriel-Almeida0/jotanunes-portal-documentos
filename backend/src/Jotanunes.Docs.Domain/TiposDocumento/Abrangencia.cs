namespace Jotanunes.Docs.Domain.TiposDocumento;

/// <summary>
/// Abrangência do tipo de documento (data-model 002 §1). Persistida pelo nome (<c>GERAL</c>/<c>POR_OBRA</c>), igual
/// ao enum <c>Abrangencia</c> do contrato.
/// </summary>
public enum Abrangencia
{
    /// <summary>Documento da empresa: enviado uma vez, vale em todas as obras.</summary>
    GERAL,
    /// <summary>Cada obra escolhe se exige; a empresa envia um por obra.</summary>
    POR_OBRA,
}
