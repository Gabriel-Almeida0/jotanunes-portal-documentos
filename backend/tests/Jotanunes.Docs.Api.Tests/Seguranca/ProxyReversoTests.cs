using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Jotanunes.Docs.Api.Tests.Infra;

namespace Jotanunes.Docs.Api.Tests.Seguranca;

/// <summary>Atrás do nginx: X-Forwarded-For/Proto aceitos só de proxy conhecido (loopback).</summary>
public class ProxyReversoTests(ApiFactory api) : TesteApi(api)
{
    [Fact]
    public void Aceita_cabecalhos_do_proxy_somente_de_loopback()
    {
        var o = Api.Services.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        Assert.True(o.ForwardedHeaders.HasFlag(ForwardedHeaders.XForwardedFor));
        Assert.True(o.ForwardedHeaders.HasFlag(ForwardedHeaders.XForwardedProto));
        // nginx conecta por 127.0.0.1: coberto pela rede de loopback confiável (127.0.0.0/8).
        Assert.Contains(o.KnownNetworks, n => n.Contains(System.Net.IPAddress.Loopback));
        // Nenhum proxy/rede fora do loopback é confiável (cliente externo não falsifica o IP).
        Assert.All(o.KnownProxies, ip => Assert.True(System.Net.IPAddress.IsLoopback(ip)));
        Assert.All(o.KnownNetworks, n => Assert.True(System.Net.IPAddress.IsLoopback(n.Prefix)));
        Assert.DoesNotContain(o.KnownNetworks, n => n.Contains(System.Net.IPAddress.Parse("177.7.52.155")));
    }
}
