using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Application.Portas;

/// <summary>
/// Persiste as alterações pendentes. Violações de unicidade conhecidas viram <c>ErroAplicacao</c>
/// (CNPJ_DUPLICADO, CODIGO_OBRA_DUPLICADO, NOME_DUPLICADO, ENVIO_NAO_PERMITIDO).
/// </summary>
public interface IUnidadeTrabalho
{
    Task SalvarAsync(CancellationToken ct = default);

    Task<ITransacao> IniciarTransacaoAsync(CancellationToken ct = default);
}

public interface ITransacao : IAsyncDisposable
{
    Task ConfirmarAsync(CancellationToken ct = default);

    Task DesfazerAsync(CancellationToken ct = default);
}

public interface IObraRepositorio
{
    Task<Obra?> ObterAsync(Guid id, CancellationToken ct = default);

    void Adicionar(Obra obra);

    Task<PaginaResultado<ObraResumoDto>> ListarAsync(string? busca, bool? ativa, Paginacao paginacao, CancellationToken ct = default);

    Task<ObraEmpresa?> ObterVinculoAsync(Guid obraId, Guid empresaId, CancellationToken ct = default);

    /// <summary>Cria o vínculo se não existir (idempotente, seguro sob concorrência).</summary>
    Task VincularAsync(ObraEmpresa vinculo, CancellationToken ct = default);

    void RemoverVinculo(ObraEmpresa vinculo);

    /// <summary>Empresas vinculadas à obra, ordenadas por razão social.</summary>
    Task<IReadOnlyList<(Empresa Empresa, DateTimeOffset VinculadoEm)>> ListarEmpresasDaObraAsync(Guid obraId, CancellationToken ct = default);

    /// <summary>Obras às quais a empresa está vinculada, ordenadas por nome.</summary>
    Task<IReadOnlyList<Obra>> ListarObrasDaEmpresaAsync(Guid empresaId, CancellationToken ct = default);
}

public sealed record FiltroEmpresas(string? Busca, Guid? ObraId, SituacaoAcesso? SituacaoAcesso, bool? ComPendencia, DateTimeOffset Agora);

public interface IEmpresaRepositorio
{
    Task<Empresa?> ObterAsync(Guid id, CancellationToken ct = default);

    Task<Empresa?> ObterPorCnpjAsync(string cnpjNormalizado, CancellationToken ct = default);

    void Adicionar(Empresa empresa);

    /// <summary>Lista ordenada por razão social com filtros aplicados no banco.</summary>
    Task<PaginaResultado<Empresa>> ListarAsync(FiltroEmpresas filtro, Paginacao paginacao, CancellationToken ct = default);
}

public interface ITipoDocumentoRepositorio
{
    Task<TipoDocumento?> ObterAsync(Guid id, CancellationToken ct = default);

    void Adicionar(TipoDocumento tipo);

    /// <summary>Ordenados por nome.</summary>
    Task<IReadOnlyList<TipoDocumento>> ListarAsync(bool? ativo, CancellationToken ct = default);
}

public interface IConviteRepositorio
{
    void Adicionar(Convite convite);

    /// <summary>Mais recente primeiro.</summary>
    Task<IReadOnlyList<Convite>> ListarDaEmpresaAsync(Guid empresaId, CancellationToken ct = default);

    Task<Convite?> ObterUltimoAsync(Guid empresaId, CancellationToken ct = default);

    Task<Convite?> ObterPorTokenHashAsync(string tokenHash, CancellationToken ct = default);

    /// <summary>Convites da empresa ainda não usados nem substituídos (rastreados para alteração).</summary>
    Task<IReadOnlyList<Convite>> ListarAbertosAsync(Guid empresaId, CancellationToken ct = default);
}

public sealed record FiltroEnvios(StatusEnvio Status, Guid? ObraId, Guid? EmpresaId, Guid? TipoDocumentoId);

public interface IEnvioRepositorio
{
    void Adicionar(EnvioDocumento envio);

    /// <summary>Leitura sem rastreamento.</summary>
    Task<EnvioDocumento?> ObterAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<EnvioDocumento>> ListarDaEmpresaAsync(Guid empresaId, CancellationToken ct = default);

    /// <summary>Mais recente primeiro.</summary>
    Task<IReadOnlyList<EnvioDocumento>> ListarHistoricoAsync(Guid empresaId, Guid tipoDocumentoId, CancellationToken ct = default);

    Task<bool> ExisteVivoAsync(Guid empresaId, Guid tipoDocumentoId, CancellationToken ct = default);

    /// <summary>
    /// Grava a decisão (aprovado/rejeitado) somente se o envio ainda estiver EM_ANALISE.
    /// Devolve false se outra decisão chegou antes.
    /// </summary>
    Task<bool> RegistrarDecisaoAsync(EnvioDocumento envioDecidido, CancellationToken ct = default);

    Task<PaginaResultado<EnvioFilaDto>> ListarFilaAsync(FiltroEnvios filtro, Paginacao paginacao, CancellationToken ct = default);

    Task<EnvioFilaDto?> ObterFilaAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Consultas de leitura sobre a situação dos documentos (em lote, sem N+1).</summary>
public interface IConsultaDocumentos
{
    Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarPorEmpresaAsync(IReadOnlyCollection<Guid> empresaIds, CancellationToken ct = default);

    Task<PainelDto> ObterPainelAsync(DateTimeOffset agora, CancellationToken ct = default);
}
