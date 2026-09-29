using Jotanunes.Docs.Application.Portas;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Jotanunes.Docs.Infrastructure.Armazenamento;

/// <summary>Configuração do armazenamento local (seção Storage). Caminho relativo à raiz de conteúdo.</summary>
public sealed class OpcoesArmazenamento
{
    public string Root { get; set; } = "../../.data/uploads";
}

/// <summary>Grava arquivos em disco sob Storage:Root. A chave nunca contém o nome original.</summary>
public sealed class ArmazenamentoDiscoLocal : IArmazenamentoArquivos
{
    private readonly string _raiz;

    public ArmazenamentoDiscoLocal(IOptions<OpcoesArmazenamento> opcoes, IHostEnvironment ambiente)
    {
        _raiz = Path.GetFullPath(opcoes.Value.Root, ambiente.ContentRootPath);
    }

    public string Raiz => _raiz;

    public async Task SalvarAsync(string chave, Stream conteudo, CancellationToken ct = default)
    {
        var caminho = Resolver(chave);
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);
        var temporario = caminho + ".tmp-" + Guid.NewGuid().ToString("N");
        await using (var destino = new FileStream(temporario, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
        {
            await conteudo.CopyToAsync(destino, ct);
        }
        File.Move(temporario, caminho, overwrite: false);
    }

    public Task<Stream> AbrirLeituraAsync(string chave, CancellationToken ct = default) =>
        Task.FromResult<Stream>(new FileStream(Resolver(chave), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true));

    public Task ExcluirAsync(string chave, CancellationToken ct = default)
    {
        var caminho = Resolver(chave);
        if (File.Exists(caminho)) File.Delete(caminho);
        return Task.CompletedTask;
    }

    private string Resolver(string chave)
    {
        if (string.IsNullOrWhiteSpace(chave) || Path.IsPathRooted(chave) || chave.Contains("..", StringComparison.Ordinal))
        {
            throw new ArgumentException("Chave de armazenamento inválida.", nameof(chave));
        }
        var completo = Path.GetFullPath(Path.Combine(_raiz, chave));
        var raizComSeparador = _raiz.EndsWith(Path.DirectorySeparatorChar) ? _raiz : _raiz + Path.DirectorySeparatorChar;
        if (!completo.StartsWith(raizComSeparador, StringComparison.Ordinal))
        {
            throw new ArgumentException("Chave de armazenamento fora da raiz.", nameof(chave));
        }
        return completo;
    }
}

/// <summary>
/// Detecta PDF, PNG e JPEG pela assinatura de bytes (research R6) e faz uma checagem estrutural mínima do fim
/// do arquivo para recusar arquivos truncados/corrompidos. O fim é procurado nos últimos
/// <see cref="JanelaFinal"/> bytes, porque arquivos válidos reais podem ter bytes depois do marcador (quebra de
/// linha ou espaço após <c>%%EOF</c>, preenchimento/metadados após o <c>FF D9</c> de câmeras, dados após o
/// <c>IEND</c>). PDFs com atualização incremental têm vários <c>%%EOF</c>; basta o último estar no final.
/// </summary>
public sealed class DetectorFormato : IDetectorFormato
{
    public const int JanelaFinal = 1024;

    private static readonly byte[] Pdf = "%PDF-"u8.ToArray();
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF];

    private static readonly byte[] FimPdf = "%%EOF"u8.ToArray();
    // Chunk IEND completo: tipo "IEND" + CRC fixo AE 42 60 82 (comprimento zero antes do tipo).
    private static readonly byte[] FimPng = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
    private static readonly byte[] FimJpeg = [0xFF, 0xD9];

    // Menores tamanhos plausíveis: assinatura + marcador final (PNG: assinatura + IHDR de 25 bytes + IEND).
    private const int MinimoPng = 8 + 25 + 12;
    private const int MinimoJpeg = 3 + 2;

    public string? Detectar(ReadOnlySpan<byte> inicio)
    {
        if (inicio.StartsWith(Pdf)) return "application/pdf";
        if (inicio.StartsWith(Png)) return "image/png";
        if (inicio.StartsWith(Jpeg)) return "image/jpeg";
        return null;
    }

    public bool EstaIntegro(string formato, ReadOnlySpan<byte> conteudo) => formato switch
    {
        "application/pdf" => conteudo.Length >= Pdf.Length + FimPdf.Length && Final(conteudo, Pdf.Length).IndexOf(FimPdf) >= 0,
        "image/png" => conteudo.Length >= MinimoPng && Final(conteudo, MinimoPng - FimPng.Length).IndexOf(FimPng) >= 0,
        "image/jpeg" => conteudo.Length >= MinimoJpeg && Final(conteudo, Jpeg.Length).IndexOf(FimJpeg) >= 0,
        _ => false,
    };

    /// <summary>Últimos <see cref="JanelaFinal"/> bytes, sem voltar antes de <paramref name="inicioMinimo"/> (não reaproveita a assinatura).</summary>
    private static ReadOnlySpan<byte> Final(ReadOnlySpan<byte> conteudo, int inicioMinimo) =>
        conteudo[Math.Max(inicioMinimo, conteudo.Length - JanelaFinal)..];
}
