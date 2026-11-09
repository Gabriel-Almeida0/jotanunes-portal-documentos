using System.Security.Cryptography;
using Jotanunes.Docs.Application.Comum;
using Jotanunes.Docs.Application.Erros;
using Jotanunes.Docs.Application.Portas;
using Jotanunes.Docs.Domain.Envios;

namespace Jotanunes.Docs.Application.Envios.Recebimento;

/// <summary>Arquivo já conferido: bytes (posição 0), formato detectado e hash.</summary>
internal sealed record ArquivoInspecionado(MemoryStream Bytes, string Formato, string Sha256) : IDisposable
{
    public void Dispose() => Bytes.Dispose();
}

/// <summary>Etapa 5: vazio → 400, formato desconhecido → 415, truncado → 400, acima de 10 MB → 413.</summary>
public sealed class InspecionarArquivo(IDetectorFormato detector) : ICasoDeUso
{
    private const int TamanhoBloco = 81920;

    internal async Task<ArquivoInspecionado> InspecionarAsync(Stream conteudo, CancellationToken ct)
    {
        var bytes = await LerComLimiteAsync(conteudo, ct);
        try
        {
            return Analisar(bytes);
        }
        catch
        {
            bytes.Dispose();
            throw;
        }
    }

    private static async Task<MemoryStream> LerComLimiteAsync(Stream conteudo, CancellationToken ct)
    {
        var bytes = new MemoryStream();
        var bloco = new byte[TamanhoBloco];
        int lidos;
        while ((lidos = await conteudo.ReadAsync(bloco, ct)) > 0)
        {
            if (bytes.Length + lidos > EnvioDocumento.TamanhoMaximoBytes)
            {
                bytes.Dispose();
                throw new ErroAplicacao(CodigoErro.ARQUIVO_MUITO_GRANDE);
            }
            bytes.Write(bloco, 0, lidos);
        }
        return bytes;
    }

    private ArquivoInspecionado Analisar(MemoryStream bytes)
    {
        if (bytes.Length == 0) throw new ErroAplicacao(CodigoErro.ARQUIVO_INVALIDO);

        var conteudo = bytes.GetBuffer().AsSpan(0, (int)bytes.Length);
        var formato = detector.Detectar(conteudo) ?? throw new ErroAplicacao(CodigoErro.ARQUIVO_TIPO_NAO_SUPORTADO);
        if (!detector.EstaIntegro(formato, conteudo)) throw new ErroAplicacao(CodigoErro.ARQUIVO_INVALIDO); // truncado/corrompido

        var sha256 = Convert.ToHexString(SHA256.HashData(conteudo)).ToLowerInvariant();
        bytes.Position = 0;
        return new ArquivoInspecionado(bytes, formato, sha256);
    }
}
