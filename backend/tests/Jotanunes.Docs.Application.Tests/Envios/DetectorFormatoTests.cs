using Jotanunes.Docs.Application.Envios;
using Jotanunes.Docs.Infrastructure.Armazenamento;

namespace Jotanunes.Docs.Application.Tests.Envios;

public class DetectorFormatoTests
{
    private readonly DetectorFormato _detector = new();

    [Fact]
    public void Pdf() => Assert.Equal("application/pdf", _detector.Detectar("%PDF-1.7\n..."u8));

    [Fact]
    public void Png() => Assert.Equal("image/png", _detector.Detectar(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0 }));

    [Fact]
    public void Jpeg() => Assert.Equal("image/jpeg", _detector.Detectar(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10 }));

    [Fact]
    public void Exe_recusado() => Assert.Null(_detector.Detectar(new byte[] { 0x4D, 0x5A, 0x90, 0x00 }));

    [Fact]
    public void Texto_recusado() => Assert.Null(_detector.Detectar("isto é um texto qualquer"u8));

    [Fact]
    public void Vazio_ou_truncado_recusado()
    {
        Assert.Null(_detector.Detectar(ReadOnlySpan<byte>.Empty));
        Assert.Null(_detector.Detectar("%PD"u8));
        Assert.Null(_detector.Detectar(new byte[] { 0x89, 0x50, 0x4E, 0x47 }));
    }

    [Theory]
    [InlineData("documento.pdf", "documento.pdf")]
    [InlineData("C:\\Users\\fulano\\cartão.pdf", "cartão.pdf")]
    [InlineData("../../etc/passwd", "passwd")]
    [InlineData("  ", "arquivo")]
    [InlineData(null, "arquivo")]
    [InlineData("a\u0000b<>:\"|?*.pdf", "ab.pdf")]
    public void Nome_saneado(string? entrada, string esperado) => Assert.Equal(esperado, NomeArquivo.Sanear(entrada));

    [Fact]
    public void Nome_longo_truncado_mantendo_extensao()
    {
        var nome = NomeArquivo.Sanear(new string('a', 300) + ".pdf");
        Assert.Equal(255, nome.Length);
        Assert.EndsWith(".pdf", nome);
    }
}
