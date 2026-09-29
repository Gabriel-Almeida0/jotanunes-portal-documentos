using Jotanunes.Docs.Domain.Comum;
using Jotanunes.Docs.Domain.Empresas;

namespace Jotanunes.Docs.Domain.Tests.Empresas;

public class CnpjTests
{
    [Theory]
    [InlineData("12.345.678/0001-95", "12345678000195")]
    [InlineData("11222333000181", "11222333000181")]
    [InlineData("11.222.333/0001-81", "11222333000181")]
    [InlineData("12.ABC.345/01DE-35", "12ABC34501DE35")]
    [InlineData("12.abc.345/01de-35", "12ABC34501DE35")]
    [InlineData(" 12 345 678 0001 95 ", "12345678000195")]
    public void Aceita_e_normaliza(string entrada, string esperado)
    {
        var cnpj = Cnpj.Criar(entrada);
        Assert.Equal(esperado, cnpj.Valor);
        Assert.Equal(14, cnpj.Valor.Length);
    }

    [Theory]
    [InlineData("12.345.678/0001-96")] // DV errado
    [InlineData("12.345.678/0001-05")]
    [InlineData("12.ABC.345/01DE-36")]
    [InlineData("11111111111111")] // todos iguais
    [InlineData("AAAAAAAAAAAA00")]
    [InlineData("1234567800019")] // 13
    [InlineData("123456780001950")] // 15
    [InlineData("12ABC34501DEA5")] // letra no DV
    [InlineData("12ABC34501DE3A")]
    [InlineData("12.345.678/0001-9!")]
    [InlineData("")]
    [InlineData(null)]
    public void Recusa_invalidos(string? entrada)
    {
        Assert.False(Cnpj.TryCriar(entrada, out _));
        var erro = Assert.Throws<ErroDominio>(() => Cnpj.Criar(entrada));
        Assert.Equal(TipoErroDominio.Validacao, erro.Tipo);
        Assert.True(erro.Erros.ContainsKey("cnpj"));
    }

    [Fact]
    public void Formata_com_mascara()
    {
        Assert.Equal("12.ABC.345/01DE-35", Cnpj.Criar("12ABC34501DE35").Formatado);
    }

    [Fact]
    public void Normaliza_remove_mascara_e_espacos()
    {
        Assert.Equal("12ABC34501DE35", Cnpj.Normalizar(" 12.abc.345/01de-35 "));
    }
}
