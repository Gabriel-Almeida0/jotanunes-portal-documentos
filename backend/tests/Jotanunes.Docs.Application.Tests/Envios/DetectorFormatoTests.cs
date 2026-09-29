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

    // Arquivos reais pequenos: PNG 1×1 e o mesmo convertido para JPEG pelo `sips` do macOS.
    private static readonly byte[] PngReal = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static readonly byte[] JpegReal = Convert.FromBase64String(
        "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+mKKKK/Kz/QA/9k=");

    private static byte[] PdfReal(string depoisDoEof = "\n", int recheio = 0) => System.Text.Encoding.ASCII.GetBytes(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n"
        + new string('%', recheio) + "xref\n0 3\n0000000000 65535 f \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n9\n%%EOF" + depoisDoEof);

    [Fact]
    public void Arquivos_reais_integros()
    {
        Assert.True(_detector.EstaIntegro("application/pdf", PdfReal()));
        Assert.True(_detector.EstaIntegro("image/png", PngReal));
        Assert.True(_detector.EstaIntegro("image/jpeg", JpegReal));
        Assert.Equal("image/png", _detector.Detectar(PngReal));
        Assert.Equal("image/jpeg", _detector.Detectar(JpegReal));
    }

    [Theory]
    [InlineData("")]
    [InlineData("\n")]
    [InlineData("\r\n")]
    [InlineData("\r\n\0\0\0   \n")]
    public void Pdf_com_bytes_apos_o_eof_e_integro(string depois) =>
        Assert.True(_detector.EstaIntegro("application/pdf", PdfReal(depois)));

    [Fact]
    public void Pdf_com_atualizacao_incremental_e_integro()
    {
        var incremental = PdfReal().Concat(System.Text.Encoding.ASCII.GetBytes(
            "3 0 obj\n<< >>\nendobj\nxref\n3 1\n0000000200 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R /Prev 9 >>\nstartxref\n300\n%%EOF\n")).ToArray();
        Assert.True(_detector.EstaIntegro("application/pdf", incremental));
    }

    [Fact]
    public void Imagens_com_dados_apos_o_marcador_final_sao_integras()
    {
        Assert.True(_detector.EstaIntegro("image/png", PngReal.Concat(new byte[100]).ToArray()));
        Assert.True(_detector.EstaIntegro("image/jpeg", JpegReal.Concat(new byte[100]).ToArray()));
    }

    [Fact]
    public void Arquivos_truncados_nao_sao_integros()
    {
        var pdf = PdfReal(recheio: 5000);
        foreach (var corte in new[] { pdf.Length - 2, pdf.Length - 4, pdf.Length / 2, 20 }) // PdfReal termina em "%%EOF\n"
        {
            Assert.False(_detector.EstaIntegro("application/pdf", pdf[..corte]));
        }
        foreach (var corte in new[] { PngReal.Length - 1, PngReal.Length - 12, 40, 8 })
        {
            Assert.False(_detector.EstaIntegro("image/png", PngReal[..corte]));
        }
        foreach (var corte in new[] { JpegReal.Length - 1, JpegReal.Length / 2, 3 })
        {
            Assert.False(_detector.EstaIntegro("image/jpeg", JpegReal[..corte]));
        }
    }

    [Fact]
    public void Eof_so_no_inicio_de_arquivo_grande_nao_conta()
    {
        // %%EOF fora da janela final (arquivo cortado depois de um trecho que por acaso contém o marcador)
        var pdf = "%PDF-1.4\n%%EOF\n"u8.ToArray().Concat(new byte[DetectorFormato.JanelaFinal + 10]).ToArray();
        Assert.False(_detector.EstaIntegro("application/pdf", pdf));
    }

    [Fact]
    public void Assinatura_nao_conta_como_marcador_final()
    {
        Assert.False(_detector.EstaIntegro("image/jpeg", new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00 }));
        Assert.False(_detector.EstaIntegro("application/pdf", "%PDF-"u8));
        Assert.False(_detector.EstaIntegro("text/plain", "%PDF-1.4\n%%EOF"u8));
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
