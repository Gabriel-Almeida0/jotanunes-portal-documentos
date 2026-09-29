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

/// <summary>Detecta PDF, PNG e JPEG pela assinatura de bytes (research R6).</summary>
public sealed class DetectorFormato : IDetectorFormato
{
    private static readonly byte[] Pdf = "%PDF-"u8.ToArray();
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF];

    public string? Detectar(ReadOnlySpan<byte> inicio)
    {
        if (inicio.StartsWith(Pdf)) return "application/pdf";
        if (inicio.StartsWith(Png)) return "image/png";
        if (inicio.StartsWith(Jpeg)) return "image/jpeg";
        return null;
    }
}
