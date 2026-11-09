namespace Jotanunes.Docs.Application.Envios.Recebimento;

/// <summary>O que a empresa entregou no balcão. <see cref="ObraId"/> null = documento geral.</summary>
public sealed record PedidoDeEnvio(
    Guid TipoDocumentoId,
    Guid? ObraId,
    DateOnly? PeriodoInicio,
    Stream Conteudo,
    string? NomeOriginal);
