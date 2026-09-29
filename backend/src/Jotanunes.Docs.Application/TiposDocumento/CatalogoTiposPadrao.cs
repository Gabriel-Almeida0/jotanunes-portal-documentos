using System.Collections.ObjectModel;

namespace Jotanunes.Docs.Application.TiposDocumento;

public sealed record TipoPadrao(string Nome, string Instrucoes);

/// <summary>
/// Os 10 tipos de documento criados numa instalação nova (data-model.md §4.1, FR-090). Depois de criados são tipos
/// comuns: o administrador edita, desativa e complementa pela tela (FR-092).
/// </summary>
public static class CatalogoTiposPadrao
{
    /// <summary>Autor registrado em <c>criado_por_login</c> (FR-093).</summary>
    public const string Autor = "sistema";

    public static IReadOnlyList<TipoPadrao> Itens { get; } = new ReadOnlyCollection<TipoPadrao>(
    [
        new("Cartão CNPJ",
            "Envie o comprovante de inscrição e situação cadastral do CNPJ, emitido no site da Receita Federal, com data de emissão recente."),
        new("Contrato Social e última alteração",
            "Envie o contrato social e a última alteração contratual (ou a consolidação), com o registro na Junta Comercial."),
        new("CND Federal (Receita Federal/PGFN)",
            "Envie a certidão de débitos relativos a tributos federais e à dívida ativa da União, emitida no site da Receita Federal e dentro da validade."),
        new("CND Estadual",
            "Envie a certidão negativa de débitos estaduais, emitida pela Secretaria da Fazenda do estado da sede da empresa e dentro da validade."),
        new("CND Municipal",
            "Envie a certidão negativa de débitos municipais, emitida pela prefeitura da cidade da sede da empresa e dentro da validade."),
        new("CRF do FGTS",
            "Envie o Certificado de Regularidade do FGTS (CRF), emitido no site da Caixa e dentro da validade."),
        new("CNDT (Certidão Negativa de Débitos Trabalhistas)",
            "Envie a CNDT emitida no site do Tribunal Superior do Trabalho (TST), dentro da validade."),
        new("PGR (Programa de Gerenciamento de Riscos)",
            "Envie o PGR vigente da empresa, com o inventário de riscos e o plano de ação, assinado pelo responsável."),
        new("PCMSO (Programa de Controle Médico de Saúde Ocupacional)",
            "Envie o PCMSO vigente, assinado pelo médico do trabalho responsável."),
        new("ART/RRT",
            "Envie a ART (CREA) ou o RRT (CAU) do responsável técnico pelos serviços contratados, com o comprovante de pagamento."),
    ]);
}
