using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Dtos;
using Jotanunes.Docs.Domain.Convites;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Envios;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;
using Jotanunes.Docs.Domain.UsuariosInternos;

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

/// <summary>
/// Bloqueio exclusivo entre instâncias da aplicação, mantido até o fim da transação atual da unidade de trabalho
/// (exige transação aberta por <see cref="IUnidadeTrabalho.IniciarTransacaoAsync"/>).
/// </summary>
public interface IBloqueioExclusivo
{
    Task AdquirirAsync(long chave, CancellationToken ct = default);
}

public sealed record FiltroObras(string? Busca, bool? Ativa, bool? ComPendencia);

/// <summary>Vínculo encerrado com a contagem de envios da empresa na obra (ObraDetalhe.vinculosEncerrados).</summary>
public sealed record VinculoEncerradoLinha(Empresa Empresa, ObraEmpresa Vinculo, int QuantidadeEnvios);

/// <summary>Obra da empresa com a situação do vínculo (Empresa.obras).</summary>
public sealed record ObraDaEmpresaLinha(Obra Obra, bool VinculoAtivo);

public interface IObraRepositorio
{
    Task<Obra?> ObterAsync(Guid id, CancellationToken ct = default);

    void Adicionar(Obra obra);

    /// <summary>Ordenada por nome; <c>quantidadeEmpresas</c> conta só vínculos ativos.</summary>
    Task<PaginaResultado<ObraResumoDto>> ListarAsync(FiltroObras filtro, Paginacao paginacao, CancellationToken ct = default);

    /// <summary>Vínculo ativo ou encerrado (rastreado para alteração).</summary>
    Task<ObraEmpresa?> ObterVinculoAsync(Guid obraId, Guid empresaId, CancellationToken ct = default);

    /// <summary>Cria o vínculo se não existir (idempotente, seguro sob concorrência). Não reabre vínculo encerrado.</summary>
    Task VincularAsync(ObraEmpresa vinculo, CancellationToken ct = default);

    /// <summary>Empresas com vínculo ATIVO na obra, ordenadas por razão social.</summary>
    Task<IReadOnlyList<(Empresa Empresa, DateTimeOffset VinculadoEm)>> ListarEmpresasDaObraAsync(Guid obraId, CancellationToken ct = default);

    /// <summary>Vínculos encerrados da obra (mais recente primeiro) com a quantidade de envios da empresa na obra.</summary>
    Task<IReadOnlyList<VinculoEncerradoLinha>> ListarVinculosEncerradosAsync(Guid obraId, CancellationToken ct = default);

    /// <summary>Obras com vínculo ATIVO da empresa (ativas ou não), ordenadas por nome.</summary>
    Task<IReadOnlyList<Obra>> ListarObrasDaEmpresaAsync(Guid empresaId, CancellationToken ct = default);

    /// <summary>Todas as obras vinculadas à empresa, inclusive vínculos encerrados, ordenadas por nome.</summary>
    Task<IReadOnlyList<ObraDaEmpresaLinha>> ListarVinculosDaEmpresaAsync(Guid empresaId, CancellationToken ct = default);

    /// <summary>Marcações de tipos exigidos na obra.</summary>
    Task<IReadOnlyList<ObraTipoDocumento>> ListarTiposMarcadosAsync(Guid obraId, CancellationToken ct = default);

    /// <summary>Marcação (rastreada) ou null.</summary>
    Task<ObraTipoDocumento?> ObterMarcacaoAsync(Guid obraId, Guid tipoDocumentoId, CancellationToken ct = default);

    /// <summary>Grava a marcação se não existir (idempotente, seguro sob concorrência). True se criou agora.</summary>
    Task<bool> MarcarTipoAsync(ObraTipoDocumento marcacao, CancellationToken ct = default);

    void DesmarcarTipo(ObraTipoDocumento marcacao);

    /// <summary>Remove a marcação do tipo em todas as obras (gravado no próximo SalvarAsync).</summary>
    Task RemoverMarcacoesDoTipoAsync(Guid tipoDocumentoId, CancellationToken ct = default);

    /// <summary>Quantidade de tipos marcados e ativos na obra.</summary>
    Task<int> ContarTiposExigidosAsync(Guid obraId, CancellationToken ct = default);
}

/// <param name="ComAtraso">true = só empresas com algum período de documento periódico atrasado (003); false/null = sem filtro.</param>
public sealed record FiltroEmpresas(string? Busca, Guid? ObraId, SituacaoAcesso? SituacaoAcesso, bool? ComPendencia, DateTimeOffset Agora,
    bool ComAtraso = false);

public interface IEmpresaRepositorio
{
    Task<Empresa?> ObterAsync(Guid id, CancellationToken ct = default);

    Task<Empresa?> ObterPorCnpjAsync(string cnpjNormalizado, CancellationToken ct = default);

    void Adicionar(Empresa empresa);

    /// <summary>Lista ordenada por razão social com filtros aplicados no banco.</summary>
    Task<PaginaResultado<Empresa>> ListarAsync(FiltroEmpresas filtro, Paginacao paginacao, CancellationToken ct = default);
}

/// <summary>
/// Falhas de login por CNPJ sem empresa com senha (anti-enumeração, FR-062). O adaptador guarda só uma
/// chave derivada do CNPJ (HMAC), nunca o CNPJ digitado em texto puro.
/// </summary>
public interface ITentativasLoginRepositorio
{
    /// <summary>Contador rastreado do CNPJ normalizado; criado (zerado) se ainda não existir. Seguro sob concorrência.</summary>
    Task<TentativasLoginCnpj> ObterOuCriarAsync(string cnpjNormalizado, CancellationToken ct = default);

    /// <summary>
    /// Mesmo contador para um login do login próprio que não corresponde a usuário interno (FR-104). A chave é
    /// derivada de <c>"usuario:" + login</c> com um segredo e rótulo próprios: não colide com as chaves de CNPJ.
    /// </summary>
    Task<TentativasLoginCnpj> ObterOuCriarPorLoginLocalAsync(string loginNormalizado, CancellationToken ct = default);
}

public sealed record FiltroUsuariosInternos(string? Busca, bool? Ativo, bool? Admin);

/// <summary>Usuários internos do login próprio (data-model §10).</summary>
public interface IUsuarioInternoRepositorio
{
    /// <summary>Rastreado (para alteração).</summary>
    Task<UsuarioInterno?> ObterAsync(Guid id, CancellationToken ct = default);

    /// <summary>Pelo login já normalizado (minúsculas); rastreado.</summary>
    Task<UsuarioInterno?> ObterPorLoginAsync(string loginNormalizado, CancellationToken ct = default);

    /// <summary>Ordenada por nome (sem diferenciar maiúsculas/acentos); busca em nome, login e e-mail.</summary>
    Task<PaginaResultado<UsuarioInterno>> ListarAsync(FiltroUsuariosInternos filtro, Paginacao paginacao, CancellationToken ct = default);

    /// <summary>Usuários com <c>admin AND ativo</c> no banco (ignora o bloqueio temporário).</summary>
    Task<int> ContarAdministradoresAtivosAsync(CancellationToken ct = default);

    /// <summary>Login repetido (sem diferenciar maiúsculas) → LOGIN_DUPLICADO ao salvar.</summary>
    void Adicionar(UsuarioInterno usuario);
}

public interface ITipoDocumentoRepositorio
{
    Task<TipoDocumento?> ObterAsync(Guid id, CancellationToken ct = default);

    void Adicionar(TipoDocumento tipo);

    /// <summary>Ordenados por nome. <paramref name="periodico"/>: true = MESES/DIAS; false = UNICA; null = todos.</summary>
    Task<IReadOnlyList<TipoDocumento>> ListarAsync(bool? ativo, Abrangencia? abrangencia = null, bool? periodico = null, CancellationToken ct = default);

    /// <summary>O tipo tem algum envio (de qualquer empresa, obra ou status)?</summary>
    Task<bool> TemEnviosAsync(Guid tipoDocumentoId, CancellationToken ct = default);

    /// <summary>Existe qualquer tipo cadastrado (ativo ou inativo)?</summary>
    Task<bool> ExisteAlgumAsync(CancellationToken ct = default);
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

/// <param name="ObraId">Somente envios desta obra (<c>envios_documento.obra_id</c>).</param>
/// <param name="SomenteGerais">Somente envios sem obra.</param>
/// <param name="ComAtraso">Somente envios feitos depois do prazo do período (<c>enviado_com_atraso</c>).</param>
public sealed record FiltroEnvios(StatusEnvio Status, Guid? ObraId, Guid? EmpresaId, Guid? TipoDocumentoId, bool SomenteGerais = false,
    bool ComAtraso = false);

public interface IEnvioRepositorio
{
    void Adicionar(EnvioDocumento envio);

    /// <summary>Leitura sem rastreamento.</summary>
    Task<EnvioDocumento?> ObterAsync(Guid id, CancellationToken ct = default);

    /// <summary>Envios da empresa no contexto: <paramref name="obraId"/> null = gerais; senão, os da obra.</summary>
    Task<IReadOnlyList<EnvioDocumento>> ListarDaEmpresaAsync(Guid empresaId, Guid? obraId, CancellationToken ct = default);

    /// <summary>Mais recente primeiro; <paramref name="obraId"/> null = gerais; <paramref name="periodoInicio"/> = só os envios daquele período.</summary>
    Task<IReadOnlyList<EnvioDocumento>> ListarHistoricoAsync(Guid empresaId, Guid tipoDocumentoId, Guid? obraId, DateOnly? periodoInicio = null,
        CancellationToken ct = default);

    /// <summary>Existe envio não rejeitado do documento (empresa × tipo × obra × período; obra/período null = geral/único)?</summary>
    Task<bool> ExisteVivoAsync(Guid empresaId, Guid tipoDocumentoId, Guid? obraId, DateOnly? periodoInicio = null, CancellationToken ct = default);

    /// <summary>Quantidade de envios (qualquer status) de cada empresa na obra.</summary>
    Task<IReadOnlyDictionary<Guid, int>> ContarNaObraAsync(Guid obraId, IReadOnlyCollection<Guid> empresaIds, CancellationToken ct = default);

    /// <summary>
    /// Grava a decisão (aprovado/rejeitado) somente se o envio ainda estiver EM_ANALISE.
    /// Devolve false se outra decisão chegou antes.
    /// </summary>
    Task<bool> RegistrarDecisaoAsync(EnvioDocumento envioDecidido, CancellationToken ct = default);

    Task<PaginaResultado<EnvioFilaDto>> ListarFilaAsync(FiltroEnvios filtro, Paginacao paginacao, CancellationToken ct = default);

    Task<EnvioFilaDto?> ObterFilaAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// Consultas de leitura sobre a situação dos documentos (em lote, sem N+1). Regras: data-model 002 §5; documentos
/// periódicos contam uma vez pela situação resumida e somam <c>periodosAtrasados</c> (003 data-model §3).
/// </summary>
public interface IConsultaDocumentos
{
    /// <summary>Contagem dos documentos GERAIS (total = tipos GERAL ativos).</summary>
    Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarPorEmpresaAsync(IReadOnlyCollection<Guid> empresaIds, CancellationToken ct = default);

    /// <summary>Contagem dos documentos da obra para cada empresa (total = tipos marcados e ativos na obra).</summary>
    Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarPorObraAsync(Guid obraId, IReadOnlyCollection<Guid> empresaIds, CancellationToken ct = default);

    /// <summary>Contagem dos documentos de cada obra para uma empresa (chave = obraId).</summary>
    Task<IReadOnlyDictionary<Guid, ContagemDocumentosDto>> ContarObrasDaEmpresaAsync(Guid empresaId, IReadOnlyCollection<Guid> obraIds, CancellationToken ct = default);

    Task<PainelDto> ObterPainelAsync(DateTimeOffset agora, CancellationToken ct = default);
}
