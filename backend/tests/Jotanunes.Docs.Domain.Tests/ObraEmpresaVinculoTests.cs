using Jotanunes.Docs.Domain.Obras;

namespace Jotanunes.Docs.Domain.Tests;

public class ObraEmpresaVinculoTests
{
    private static readonly DateTimeOffset Agora = new(2026, 10, 26, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Novo_vinculo_e_ativo()
    {
        var v = new ObraEmpresa(Guid.NewGuid(), Guid.NewGuid(), "ana", Agora);
        Assert.True(v.Ativo);
        Assert.Null(v.EncerradoEm);
        Assert.Null(v.EncerradoPorLogin);
    }

    [Fact]
    public void Encerrar_e_idempotente()
    {
        var v = new ObraEmpresa(Guid.NewGuid(), Guid.NewGuid(), "ana", Agora);
        Assert.True(v.Encerrar("bia", Agora.AddHours(1)));
        Assert.False(v.Ativo);
        Assert.Equal(Agora.AddHours(1), v.EncerradoEm);
        Assert.Equal("bia", v.EncerradoPorLogin);

        Assert.False(v.Encerrar("caio", Agora.AddHours(2)));
        Assert.Equal(Agora.AddHours(1), v.EncerradoEm);
        Assert.Equal("bia", v.EncerradoPorLogin);
    }

    [Fact]
    public void Reabrir_limpa_encerramento_e_atualiza_autoria()
    {
        var v = new ObraEmpresa(Guid.NewGuid(), Guid.NewGuid(), "ana", Agora);
        Assert.False(v.Reabrir("bia", Agora.AddHours(1))); // já ativo
        Assert.Equal("ana", v.VinculadoPorLogin);

        v.Encerrar("bia", Agora.AddHours(1));
        Assert.True(v.Reabrir("caio", Agora.AddHours(2)));
        Assert.True(v.Ativo);
        Assert.Null(v.EncerradoEm);
        Assert.Null(v.EncerradoPorLogin);
        Assert.Equal(Agora.AddHours(2), v.VinculadoEm);
        Assert.Equal("caio", v.VinculadoPorLogin);
    }
}
