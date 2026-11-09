using Jotanunes.Docs.Application.Emails;

namespace Jotanunes.Docs.Application.Tests.Emails;

/// <summary>E-mail de rejeição com e sem obra (002 research R11).</summary>
public class ModelosEmailRejeicaoTests
{
    [Fact]
    public void Sem_obra_continua_igual_ao_documento_geral()
    {
        var m = ModelosEmail.Rejeicao("a@b.test", "Alfa", "Cartão CNPJ", "Ilegível", "http://portal/documentos");
        Assert.Equal("Jotanunes: o documento Cartão CNPJ precisa ser enviado de novo", m.Assunto);
        Assert.Contains("Analisamos o documento \"Cartão CNPJ\" e ele precisa", m.Texto);
        Assert.DoesNotContain("na obra", m.Texto);
        Assert.DoesNotContain("na obra", m.Html);
        Assert.Contains("http://portal/documentos", m.Texto);
    }

    [Fact]
    public void Com_obra_cita_a_obra_no_assunto_texto_e_html()
    {
        var m = ModelosEmail.Rejeicao("a@b.test", "Alfa", "ART da obra", "Sem assinatura", "http://portal/obras/123", "Residencial <Mar>");
        Assert.Equal("Jotanunes: o documento ART da obra precisa ser enviado de novo (obra Residencial <Mar>)", m.Assunto);
        Assert.Contains("Analisamos o documento \"ART da obra\" na obra Residencial <Mar> e ele precisa", m.Texto);
        Assert.Contains("na obra <strong>Residencial &lt;Mar&gt;</strong>", m.Html);
        Assert.Contains("http://portal/obras/123", m.Html);
    }

    [Fact]
    public void Periodico_cita_o_periodo_e_a_obra()
    {
        var m = ModelosEmail.Rejeicao("a@b.test", "Alfa", "Guia do FGTS", "Valor errado", "http://portal/x", "Residencial Mar", "Agosto/2026");
        Assert.Equal("Jotanunes: o documento Guia do FGTS precisa ser enviado de novo (Agosto/2026, obra Residencial Mar)", m.Assunto);
        Assert.Contains("Analisamos o documento \"Guia do FGTS\" do período Agosto/2026 na obra Residencial Mar e ele precisa", m.Texto);
        Assert.Contains("do período <strong>Agosto/2026</strong>", m.Html);

        var geral = ModelosEmail.Rejeicao("a@b.test", "Alfa", "Guia do FGTS", "Valor errado", "http://portal/x", periodo: "Agosto/2026");
        Assert.Equal("Jotanunes: o documento Guia do FGTS precisa ser enviado de novo (Agosto/2026)", geral.Assunto);
        Assert.DoesNotContain("na obra", geral.Texto);
    }
}
