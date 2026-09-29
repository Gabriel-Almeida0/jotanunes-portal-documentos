using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Empresas;
using Jotanunes.Docs.Domain.Obras;
using Jotanunes.Docs.Domain.TiposDocumento;

namespace Jotanunes.Docs.Domain.Tests;

public class CadastrosTests
{
    private static readonly DateTimeOffset Agora = new(2026, 9, 28, 12, 0, 0, TimeSpan.Zero);

    private static ErroDominio ErroEm(Action a, string campo)
    {
        var erro = Assert.Throws<ErroDominio>(a);
        Assert.Equal(TipoErroDominio.Validacao, erro.Tipo);
        Assert.True(erro.Erros.ContainsKey(campo), $"esperava erro no campo '{campo}', veio: {string.Join(",", erro.Erros.Keys)}");
        return erro;
    }

    [Fact]
    public void Obra_valida_e_normalizada()
    {
        var obra = Obra.Criar("  Residencial Vista do Rio ", " rvr-01 ", "Aracaju", "se", "dev.analista", Agora);
        Assert.Equal("Residencial Vista do Rio", obra.Nome);
        Assert.Equal("rvr-01", obra.Codigo);
        Assert.Equal(Uf.SE, obra.Uf);
        Assert.True(obra.Ativa);
        Assert.Equal("dev.analista", obra.CriadoPorLogin);
        Assert.NotEqual(Guid.Empty, obra.Id);
    }

    [Theory]
    [InlineData("ab", "Aracaju", "SE", null, "nome")]
    [InlineData(null, "Aracaju", "SE", null, "nome")]
    [InlineData("Obra boa", "A", "SE", null, "cidade")]
    [InlineData("Obra boa", "Aracaju", "XX", null, "uf")]
    [InlineData("Obra boa", "Aracaju", "1", null, "uf")]
    [InlineData("Obra boa", "Aracaju", null, null, "uf")]
    [InlineData("Obra boa", "Aracaju", "SE", "1234567890123456789012345678901", "codigo")]
    public void Obra_invalida(string? nome, string? cidade, string? uf, string? codigo, string campo)
    {
        ErroEm(() => Obra.Criar(nome, codigo, cidade, uf, "x", Agora), campo);
    }

    [Fact]
    public void Obra_nome_com_mais_de_150_recusado()
    {
        ErroEm(() => Obra.Criar(new string('a', 151), null, "Aracaju", "SE", "x", Agora), "nome");
    }

    [Fact]
    public void Obra_codigo_vazio_vira_nulo_e_atualiza_desativa()
    {
        var obra = Obra.Criar("Obra boa", "  ", "Aracaju", "SE", "x", Agora);
        Assert.Null(obra.Codigo);
        obra.Atualizar("Obra nova", "C1", "Maceió", "AL", false, "y", Agora.AddHours(1));
        Assert.Equal("Obra nova", obra.Nome);
        Assert.False(obra.Ativa);
        Assert.Equal("y", obra.AtualizadoPorLogin);
        Assert.Equal(Agora.AddHours(1), obra.AtualizadoEm);
    }

    [Fact]
    public void Empresa_valida_normaliza_campos()
    {
        var e = Empresa.Criar("Alfa Engenharia Ltda", " Alfa ", "11.222.333/0001-81", " Contato@Alfa.TEST ", "Fulano", "(79) 99999-8888", "dev", Agora);
        Assert.Equal("11222333000181", e.Cnpj);
        Assert.Equal("contato@alfa.test", e.EmailContato);
        Assert.Equal("79999998888", e.Telefone);
        Assert.Equal("Alfa", e.NomeFantasia);
        Assert.True(e.Ativa);
        Assert.Null(e.SenhaHash);
        Assert.Equal(0, e.VersaoCredencial);
    }

    [Theory]
    [InlineData("A", "11222333000181", "a@b.com", null, "razaoSocial")]
    [InlineData("Alfa", "11222333000182", "a@b.com", null, "cnpj")]
    [InlineData("Alfa", "11222333000181", "nao-eh-email", null, "emailContato")]
    [InlineData("Alfa", "11222333000181", null, null, "emailContato")]
    [InlineData("Alfa", "11222333000181", "a@b.com", "123456789", "telefone")]
    [InlineData("Alfa", "11222333000181", "a@b.com", "123456789012", "telefone")]
    public void Empresa_invalida(string razao, string cnpj, string? email, string? telefone, string campo)
    {
        ErroEm(() => Empresa.Criar(razao, null, cnpj, email, null, telefone, "x", Agora), campo);
    }

    [Fact]
    public void Empresa_varios_erros_de_uma_vez()
    {
        var erro = Assert.Throws<ErroDominio>(() => Empresa.Criar("", null, "123", "x", null, null, "x", Agora));
        Assert.Contains("razaoSocial", erro.Erros.Keys);
        Assert.Contains("cnpj", erro.Erros.Keys);
        Assert.Contains("emailContato", erro.Erros.Keys);
    }

    [Fact]
    public void Empresa_email_acima_de_254_recusado()
    {
        var email = new string('a', 250) + "@b.com";
        ErroEm(() => Empresa.Criar("Alfa", null, "11222333000181", email, null, null, "x", Agora), "emailContato");
    }

    [Fact]
    public void Empresa_cnpj_so_alteravel_antes_do_convite()
    {
        var e = Empresa.Criar("Alfa", null, "11222333000181", "a@b.com", null, null, "x", Agora);
        e.Atualizar("Alfa", null, "12345678000195", "a@b.com", null, null, true, jaConvidada: false, "x", Agora);
        Assert.Equal("12345678000195", e.Cnpj);

        var erro = Assert.Throws<ErroDominio>(() =>
            e.Atualizar("Alfa", null, "11222333000181", "a@b.com", null, null, true, jaConvidada: true, "x", Agora));
        Assert.Equal(TipoErroDominio.CnpjImutavel, erro.Tipo);

        // mesmo CNPJ (com máscara) depois do convite é aceito
        e.Atualizar("Alfa 2", null, "12.345.678/0001-95", "a@b.com", null, null, true, jaConvidada: true, "x", Agora);
        Assert.Equal("Alfa 2", e.RazaoSocial);
    }

    [Fact]
    public void Empresa_desativar_incrementa_versao()
    {
        var e = Empresa.Criar("Alfa", null, "11222333000181", "a@b.com", null, null, "x", Agora);
        e.Atualizar("Alfa", null, "11222333000181", "a@b.com", null, null, false, false, "x", Agora);
        Assert.False(e.Ativa);
        Assert.Equal(1, e.VersaoCredencial);
        // continuar inativa não incrementa de novo
        e.Atualizar("Alfa", null, "11222333000181", "a@b.com", null, null, false, false, "x", Agora);
        Assert.Equal(1, e.VersaoCredencial);
        e.Atualizar("Alfa", null, "11222333000181", "a@b.com", null, null, true, false, "x", Agora);
        Assert.True(e.Ativa);
    }

    [Fact]
    public void Tipo_documento_valido()
    {
        var t = TipoDocumento.Criar("  Cartão CNPJ ", "  ", "x", Agora);
        Assert.Equal("Cartão CNPJ", t.Nome);
        Assert.Null(t.Instrucoes);
        Assert.True(t.Ativo);
        t.Atualizar("CND Federal", "Emitida no site da Receita", false, "y", Agora);
        Assert.False(t.Ativo);
        Assert.Equal("Emitida no site da Receita", t.Instrucoes);
    }

    [Fact]
    public void Tipo_documento_invalido()
    {
        ErroEm(() => TipoDocumento.Criar("ab", null, "x", Agora), "nome");
        ErroEm(() => TipoDocumento.Criar(new string('a', 121), null, "x", Agora), "nome");
        ErroEm(() => TipoDocumento.Criar("Nome ok", new string('a', 1001), "x", Agora), "instrucoes");
    }
}
