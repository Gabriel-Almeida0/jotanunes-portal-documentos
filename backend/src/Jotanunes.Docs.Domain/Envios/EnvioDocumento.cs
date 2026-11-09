using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Envios;

public sealed class EnvioDocumento
{
    public const long TamanhoMaximoBytes = 10_485_760;

    private EnvioDocumento() { }

    public Guid Id { get; private set; }
    public Guid EmpresaId { get; private set; }
    public Guid TipoDocumentoId { get; private set; }
    /// <summary>Obra do envio; null = documento geral (tipo GERAL). Ver data-model 002 §4.</summary>
    public Guid? ObraId { get; private set; }
    public string NomeArquivo { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long TamanhoBytes { get; private set; }
    public string Sha256 { get; private set; } = string.Empty;
    public string ChaveArmazenamento { get; private set; } = string.Empty;
    public DateTimeOffset EnviadoEm { get; private set; }
    public StatusEnvio Status { get; private set; }
    public DateTimeOffset? AnalisadoEm { get; private set; }
    public string? AnalisadoPorLogin { get; private set; }
    public string? AnalisadoPorNome { get; private set; }
    public string? MotivoRejeicao { get; private set; }
    /// <summary>Início do período (competência) do envio; null ⇔ tipo de periodicidade única (003 data-model §2).</summary>
    public DateOnly? PeriodoInicio { get; private set; }
    public DateOnly? PeriodoFim { get; private set; }
    /// <summary>Data do envio (fuso de Brasília) depois do prazo do período, no momento do envio.</summary>
    public bool EnviadoComAtraso { get; private set; }

    public static string GerarChaveArmazenamento(Guid empresaId, Guid envioId) => $"empresas/{empresaId:N}/{envioId:N}";

    /// <summary>
    /// Novo envio EM_ANALISE. A obra é obrigatória para tipo POR_OBRA e proibida para tipo GERAL (nulo ⇔ GERAL). O período é
    /// obrigatório para tipo periódico e proibido para tipo único (<see cref="TipoErroDominio.PeriodoObrigatorio"/>);
    /// <see cref="EnviadoComAtraso"/> = data do envio (fuso de Brasília) depois do prazo do período.
    /// </summary>
    public static EnvioDocumento Criar(Guid id, Guid empresaId, Guid tipoDocumentoId, string nomeArquivo, string contentType,
        long tamanhoBytes, string sha256, DateTimeOffset agora, Abrangencia abrangencia = Abrangencia.GERAL, Guid? obraId = null,
        bool periodico = false, PeriodoCalculado? periodo = null)
    {
        if (periodico != (periodo is not null))
        {
            throw new ErroDominio(TipoErroDominio.PeriodoObrigatorio,
                periodico ? "Informe o período do envio." : "Este documento não é periódico: não informe o período.");
        }
        if (abrangencia == Abrangencia.GERAL && obraId is not null)
        {
            throw ErroDominio.Validacao("obraId", "Documento geral não pertence a uma obra.");
        }
        if (abrangencia == Abrangencia.POR_OBRA && obraId is null)
        {
            throw ErroDominio.Validacao("obraId", "Informe a obra do documento.");
        }
        var envio = Novo(id, empresaId, tipoDocumentoId, obraId, nomeArquivo, contentType, tamanhoBytes, sha256, agora);
        if (periodo is not null)
        {
            envio.PeriodoInicio = periodo.Inicio;
            envio.PeriodoFim = periodo.Fim;
            envio.EnviadoComAtraso = DataLocal.De(agora) > periodo.Prazo;
        }
        return envio;
    }

    private static EnvioDocumento Novo(Guid id, Guid empresaId, Guid tipoDocumentoId, Guid? obraId, string nomeArquivo, string contentType,
        long tamanhoBytes, string sha256, DateTimeOffset agora) => new()
    {
        Id = id,
        EmpresaId = empresaId,
        TipoDocumentoId = tipoDocumentoId,
        ObraId = obraId,
        NomeArquivo = nomeArquivo,
        ContentType = contentType,
        TamanhoBytes = tamanhoBytes,
        Sha256 = sha256,
        ChaveArmazenamento = GerarChaveArmazenamento(empresaId, id),
        EnviadoEm = agora,
        Status = StatusEnvio.EM_ANALISE,
    };

    public void Aprovar(string login, string nome, DateTimeOffset agora)
    {
        GarantirEmAnalise();
        Status = StatusEnvio.APROVADO;
        RegistrarAnalise(login, nome, agora);
    }

    public void Rejeitar(string login, string nome, string? motivo, DateTimeOffset agora)
    {
        var m = motivo?.Trim() ?? string.Empty;
        if (m.Length is < 5 or > 500)
        {
            throw ErroDominio.Validacao("motivo", "Informe o motivo da rejeição (de 5 a 500 caracteres).");
        }
        GarantirEmAnalise();
        Status = StatusEnvio.REJEITADO;
        MotivoRejeicao = m;
        RegistrarAnalise(login, nome, agora);
    }

    private void RegistrarAnalise(string login, string nome, DateTimeOffset agora)
    {
        AnalisadoPorLogin = login;
        AnalisadoPorNome = nome;
        AnalisadoEm = agora;
    }

    private void GarantirEmAnalise()
    {
        if (Status != StatusEnvio.EM_ANALISE)
        {
            throw new ErroDominio(TipoErroDominio.TransicaoInvalida, "Este envio já foi analisado.");
        }
    }
}
