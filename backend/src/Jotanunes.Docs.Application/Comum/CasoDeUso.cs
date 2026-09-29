using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace Jotanunes.Docs.Application.Comum;

/// <summary>Marcador dos casos de uso (registrados automaticamente como scoped).</summary>
public interface ICasoDeUso;

public static class ApplicationServiceCollectionExtensions
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var tipos = Assembly.GetExecutingAssembly().GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(ICasoDeUso).IsAssignableFrom(t));
        foreach (var t in tipos) services.AddScoped(t);
        return services;
    }
}
