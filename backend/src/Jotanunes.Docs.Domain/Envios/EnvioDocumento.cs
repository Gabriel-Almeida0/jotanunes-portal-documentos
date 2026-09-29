using Jotanunes.Docs.Domain.Comum;

namespace Jotanunes.Docs.Domain.Envios;

public sealed class EnvioDocumento
{
    public const long TamanhoMaximoBytes = 10_485_760;

    private EnvioDocumento() { }

    public Guid Id { get; private set; }
    public Guid EmpresaId { get; private set; }
    public Guid TipoDocumentoId { get; private set; }
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

    public static string GerarChaveArmazenamento(Guid empresaId, Guid envioId) => $"empresas/{empresaId:N}/{envioId:N}";

    public static EnvioDocumento Criar(Guid id, Guid empresaId, Guid tipoDocumentoId, string nomeArquivo, string contentType,
        long tamanhoBytes, string sha256, DateTimeOffset agora) => new()
    {
        Id = id,
        EmpresaId = empresaId,
        TipoDocumentoId = tipoDocumentoId,
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
